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

type CachedWeather = {
  data: WeatherPayload;
  fetchedAt: number;
};

const router = Router();

const cache = new Map<string, CachedWeather>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function parseCoord(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "weather not configured" });
    }

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
      return res.status(503).json({ error: "weather location not configured" });
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
      return res.status(400).json({ error: "invalid coordinates" });
    }

    const lat = String(latNum);
    const lon = String(lonNum);
    const key = `${lat}:${lon}`;
    const now = Date.now();

    const cached = cache.get(key);
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

    cache.set(key, { data, fetchedAt: now });

    return res.json(data);
  } catch {
    return res.status(503).json({ error: "weather unavailable" });
  }
});

export default router;

