import type { Request, Response } from "express";
import { Router } from "express";
import fetch from "node-fetch";

type WeatherPayload = {
  temperature: number;
  description: string;
  icon: string | null;
  weekday: string;
  locationLabel: string | null;
};

type ForecastDayPayload = {
  date: string;
  weekdayShort: string;
  high: number;
  low: number;
  description: string;
  iconCode: string;
  main: string;
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

router.get("/", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "weather not configured" });
    }

    const loc = resolveLocation(req);
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
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "weather not configured" });
    }

    const loc = resolveLocation(req);
    if (!loc) {
      return res.status(503).json({ error: "weather location not configured" });
    }

    const { lat, lon, cacheKey } = loc;
    const forecastKey = `fc:${cacheKey}`;
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
        dt_txt: string;
        main: { temp_min: number; temp_max: number };
        weather: { main: string; description: string; icon: string }[];
      }[];
      city?: { name?: string; country?: string };
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

    const byDay = new Map<string, Agg>();

    for (const item of list) {
      const dayKey = item.dt_txt.slice(0, 10);
      const hour = Number.parseInt(item.dt_txt.slice(11, 13), 10);
      const dist = Number.isFinite(hour) ? Math.abs(hour - 12) : 12;
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
    }

    const sortedDays = [...byDay.keys()].sort().slice(0, 5);

    const days: ForecastDayPayload[] = sortedDays.map((date) => {
      const agg = byDay.get(date)!;
      return {
        date,
        weekdayShort: weekdayShortFromYmd(date),
        high: Math.round(agg.max),
        low: Math.round(agg.min),
        description: agg.w.description,
        iconCode: agg.w.icon,
        main: agg.w.main,
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
