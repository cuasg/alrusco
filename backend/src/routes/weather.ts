import type { Request, Response } from "express";
import { Router } from "express";
import fetch from "node-fetch";
import { getRuntimeIntegrationsResolved } from "../services/runtimeIntegrations";

type WeatherPayload = {
  temperature: number;
  description: string;
  icon: string | null;
  weekday: string;
  locationLabel: string | null;
};

type ForecastHourPayload = {
  /** UTC unix; for ordering (OpenWeather 3-hour steps). */
  dt: number;
  timeLabel: string;
  temp: number;
  windDeg: number;
  windSpeed: number;
  description: string;
  iconCode: string;
  main: string;
  /** Probability of precipitation, 0–1 (OpenWeather `pop`). */
  pop: number;
  /**
   * Liquid-equivalent rate in in/hr from `rain.3h` + `snow.3h` (mm over 3h → avg per hour), imperial.
   * Null when API omits volume fields (still may have pop).
   */
  precipInPerHr: number | null;
};

type ForecastDayPayload = {
  date: string;
  weekdayShort: string;
  high: number;
  low: number;
  description: string;
  iconCode: string;
  main: string;
  hours: ForecastHourPayload[];
};

type ForecastPayload = {
  days: ForecastDayPayload[];
  locationLabel: string | null;
};

type CachedWeather = {
  data: WeatherPayload;
  fetchedAt: number;
};

type CachedForecast = {
  data: ForecastPayload;
  fetchedAt: number;
};

const router = Router();

const cache = new Map<string, CachedWeather>();
const forecastCache = new Map<string, CachedForecast>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function parseCoord(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

type ResolvedLocation = { lat: string; lon: string; cacheKey: string };

function resolveLocation(req: Request): ResolvedLocation | null {
  const queryLat = req.query.lat;
  const queryLon = req.query.lon;

  const latFromQuery =
    typeof queryLat === "string"
      ? queryLat
      : Array.isArray(queryLat)
        ? String(queryLat[0])
        : undefined;
  const lonFromQuery =
    typeof queryLon === "string"
      ? queryLon
      : Array.isArray(queryLon)
        ? String(queryLon[0])
        : undefined;

  const envLat = process.env.WEATHER_LAT;
  const envLon = process.env.WEATHER_LON;

  const fixedLocation = process.env.WEATHER_FIXED_LOCATION === "true";
  const latStr = fixedLocation ? envLat : latFromQuery ?? envLat;
  const lonStr = fixedLocation ? envLon : lonFromQuery ?? envLon;

  if (!latStr || !lonStr) {
    return null;
  }

  const latNum = parseCoord(latStr);
  const lonNum = parseCoord(lonStr);
  if (
    latNum == null ||
    lonNum == null ||
    latNum < -90 ||
    latNum > 90 ||
    lonNum < -180 ||
    lonNum > 180
  ) {
    return null;
  }

  const lat = String(latNum);
  const lon = String(lonNum);
  return { lat, lon, cacheKey: `${lat}:${lon}` };
}

async function resolveLocationWithRuntime(req: Request): Promise<ResolvedLocation | null> {
  const rt = await getRuntimeIntegrationsResolved();
  const queryLat = req.query.lat;
  const queryLon = req.query.lon;

  const latFromQuery =
    typeof queryLat === "string"
      ? queryLat
      : Array.isArray(queryLat)
        ? String(queryLat[0])
        : undefined;
  const lonFromQuery =
    typeof queryLon === "string"
      ? queryLon
      : Array.isArray(queryLon)
        ? String(queryLon[0])
        : undefined;

  const latStr = rt.weatherFixedLocation ? rt.weatherLat : latFromQuery ?? rt.weatherLat;
  const lonStr = rt.weatherFixedLocation ? rt.weatherLon : lonFromQuery ?? rt.weatherLon;
  if (!latStr || !lonStr) return resolveLocation(req);

  const latNum = parseCoord(latStr);
  const lonNum = parseCoord(lonStr);
  if (
    latNum == null ||
    lonNum == null ||
    latNum < -90 ||
    latNum > 90 ||
    lonNum < -180 ||
    lonNum > 180
  ) {
    return null;
  }
  const lat = String(latNum);
  const lon = String(lonNum);
  return { lat, lon, cacheKey: `${lat}:${lon}` };
}

function weekdayShortFromYmd(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return "";
  }
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

/** OpenWeatherMap: local wall time from UTC unix + city timezone offset (seconds). */
function formatForecastLocalTimeLabel(dtUtc: number, timezoneSec: number): string {
  const d = new Date((dtUtc + timezoneSec) * 1000);
  const h24 = d.getUTCHours();
  const m = d.getUTCMinutes();
  const isPm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = m < 10 ? `0${m}` : String(m);
  return `${h12}:${mm} ${isPm ? "PM" : "AM"}`;
}

const MM_TO_IN = 0.0393701;

/** Avg liquid-equivalent in/hr from OpenWeather 3h rain+snow totals (mm). */
function precipInPerHrFrom3hBlocks(
  rainMm3h: number | undefined,
  snowMm3h: number | undefined,
): number | null {
  const r = typeof rainMm3h === "number" && Number.isFinite(rainMm3h) ? rainMm3h : 0;
  const s = typeof snowMm3h === "number" && Number.isFinite(snowMm3h) ? snowMm3h : 0;
  const totalMm3h = r + s;
  if (totalMm3h <= 0) return null;
  const mmPerHr = totalMm3h / 3;
  const inPerHr = mmPerHr * MM_TO_IN;
  return Math.round(inPerHr * 1000) / 1000;
}

function clampPop(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}

/** Calendar YYYY-MM-DD in the forecast city's local time (not UTC dt_txt date). */
function localYmdFromForecastDt(dtUtc: number, timezoneSec: number): string {
  const d = new Date((dtUtc + timezoneSec) * 1000);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const mm = mo < 10 ? `0${mo}` : String(mo);
  const dd = day < 10 ? `0${day}` : String(day);
  return `${y}-${mm}-${dd}`;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const runtime = await getRuntimeIntegrationsResolved();
    const apiKey = runtime.weatherApiKey ?? process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "weather not configured" });
    }

    const loc = await resolveLocationWithRuntime(req);
    if (!loc) {
      return res.status(503).json({ error: "weather location not configured" });
    }

    const { lat, lon, cacheKey } = loc;
    const now = Date.now();

    const cached = cache.get(cacheKey);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(
      lat,
    )}&lon=${encodeURIComponent(
      lon,
    )}&units=imperial&appid=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(503).json({ error: "upstream weather error" });
    }

    const json = (await response.json()) as {
      name?: string;
      sys?: { country?: string };
      main?: { temp?: number };
      weather?: { main?: string; description?: string; icon?: string }[];
      dt?: number;
      timezone?: number;
    };

    const temperature = json.main?.temp ?? 0;
    const description = json.weather?.[0]?.description ?? "Unknown";
    const main = json.weather?.[0]?.main ?? "";

    const ts = json.dt ?? 0;
    const tz = json.timezone ?? 0;
    const localMs = (ts + tz) * 1000;
    const weekday = new Date(localMs).toLocaleDateString("en-US", {
      weekday: "short",
    });

    let icon = "☁️";
    if (main === "Clear") icon = "☀️";
    else if (main === "Clouds") icon = "⛅️";
    else if (main === "Rain" || main === "Drizzle") icon = "🌧️";
    else if (main === "Thunderstorm") icon = "⛈️";
    else if (main === "Snow") icon = "❄️";
    else if (["Mist", "Fog", "Haze"].includes(main)) icon = "🌫️";

    const city = json.name?.trim() || "";
    const country = json.sys?.country?.trim() || "";
    const locationLabel =
      city && country ? `${city}, ${country}` : city || (country || null);

    const data: WeatherPayload = {
      temperature,
      description,
      icon,
      weekday,
      locationLabel,
    };

    cache.set(cacheKey, { data, fetchedAt: now });

    return res.json(data);
  } catch {
    return res.status(503).json({ error: "weather unavailable" });
  }
});

router.get("/forecast", async (req: Request, res: Response) => {
  try {
    const runtime = await getRuntimeIntegrationsResolved();
    const apiKey = runtime.weatherApiKey ?? process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "weather not configured" });
    }

    const loc = await resolveLocationWithRuntime(req);
    if (!loc) {
      return res.status(503).json({ error: "weather location not configured" });
    }

    const { lat, lon, cacheKey } = loc;
    const forecastKey = `fc4:${cacheKey}`;
    const now = Date.now();

    const cached = forecastCache.get(forecastKey);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(
      lat,
    )}&lon=${encodeURIComponent(
      lon,
    )}&units=imperial&appid=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(503).json({ error: "upstream forecast error" });
    }

    const json = (await response.json()) as {
      list?: {
        dt: number;
        dt_txt: string;
        pop?: number;
        rain?: { "3h"?: number };
        snow?: { "3h"?: number };
        main: { temp: number; temp_min: number; temp_max: number };
        weather: { main: string; description: string; icon: string }[];
        wind?: { speed?: number; deg?: number };
      }[];
      city?: { name?: string; country?: string; timezone?: number };
    };

    const list = json.list;
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(503).json({ error: "forecast data empty" });
    }

    type Agg = {
      min: number;
      max: number;
      bestDist: number;
      w: { main: string; description: string; icon: string };
    };

    const cityTimezone = json.city?.timezone ?? 0;

    const byDay = new Map<string, Agg>();
    const hoursByDay = new Map<string, ForecastHourPayload[]>();

    for (const item of list) {
      const dayKey = localYmdFromForecastDt(item.dt, cityTimezone);
      const localWall = new Date((item.dt + cityTimezone) * 1000);
      const localHour = localWall.getUTCHours();
      const dist = Number.isFinite(localHour) ? Math.abs(localHour - 12) : 12;
      const w = item.weather[0];
      if (!w) continue;

      const lo = item.main.temp_min;
      const hi = item.main.temp_max;
      const prev = byDay.get(dayKey);
      if (!prev) {
        byDay.set(dayKey, {
          min: lo,
          max: hi,
          bestDist: dist,
          w,
        });
      } else {
        prev.min = Math.min(prev.min, lo);
        prev.max = Math.max(prev.max, hi);
        if (dist < prev.bestDist) {
          prev.bestDist = dist;
          prev.w = w;
        }
      }

      const windSpeed = item.wind?.speed ?? 0;
      const windDeg =
        typeof item.wind?.deg === "number" && Number.isFinite(item.wind.deg)
          ? item.wind.deg
          : 0;
      const precipInPerHr = precipInPerHrFrom3hBlocks(item.rain?.["3h"], item.snow?.["3h"]);

      const slot: ForecastHourPayload = {
        dt: item.dt,
        timeLabel: formatForecastLocalTimeLabel(item.dt, cityTimezone),
        temp: Math.round(item.main.temp),
        windDeg,
        windSpeed: Math.round(windSpeed * 10) / 10,
        description: w.description,
        iconCode: w.icon,
        main: w.main,
        pop: clampPop(item.pop),
        precipInPerHr,
      };
      const bucket = hoursByDay.get(dayKey);
      if (bucket) {
        bucket.push(slot);
      } else {
        hoursByDay.set(dayKey, [slot]);
      }
    }

    const sortedDays = [...byDay.keys()].sort().slice(0, 5);

    const days: ForecastDayPayload[] = sortedDays.map((date) => {
      const agg = byDay.get(date)!;
      const hours = [...(hoursByDay.get(date) ?? [])].sort((a, b) => a.dt - b.dt);
      return {
        date,
        weekdayShort: weekdayShortFromYmd(date),
        high: Math.round(agg.max),
        low: Math.round(agg.min),
        description: agg.w.description,
        iconCode: agg.w.icon,
        main: agg.w.main,
        hours,
      };
    });

    const cname = json.city?.name?.trim() || "";
    const ccountry = json.city?.country?.trim() || "";
    const locationLabel =
      cname && ccountry ? `${cname}, ${ccountry}` : cname || ccountry || null;

    const data: ForecastPayload = { days, locationLabel };

    forecastCache.set(forecastKey, { data, fetchedAt: now });

    return res.json(data);
  } catch {
    return res.status(503).json({ error: "forecast unavailable" });
  }
});

export default router;
