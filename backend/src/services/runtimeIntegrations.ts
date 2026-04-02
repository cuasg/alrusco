import {
  decryptSecret,
  encryptSecret,
  ensureEncryptionKeyConfigured,
  isEncryptionConfigured,
} from "./githubCredentials";
import { getDb } from "../auth/userStore";

const KEY_MARKET_API_KEY_ENC = "integration_market_api_key_enc";
const KEY_FINNHUB_API_KEY_ENC = "integration_finnhub_api_key_enc";
const KEY_OPENAI_API_KEY_ENC = "integration_openai_api_key_enc";
const KEY_WEATHER_API_KEY_ENC = "integration_weather_api_key_enc";
const KEY_OPENAI_MODEL = "integration_openai_model";
const KEY_MARKET_PROVIDER = "integration_market_provider";
const KEY_MARKET_CACHE_TTL_MS = "integration_market_cache_ttl_ms";
const KEY_RSS_MIN_REFRESH_MS = "integration_rss_min_refresh_ms";
const KEY_WEATHER_FIXED_LOCATION = "integration_weather_fixed_location";
const KEY_WEATHER_LAT = "integration_weather_lat";
const KEY_WEATHER_LON = "integration_weather_lon";
const KEY_GITHUB_SYNC_EXCLUDE_FORKS = "integration_github_sync_exclude_forks";
const KEY_GITHUB_SYNC_EXCLUDE_ARCHIVED = "integration_github_sync_exclude_archived";
const KEY_GITHUB_API_USER_AGENT = "integration_github_api_user_agent";

async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<{ value: string } | undefined>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM settings WHERE key = ?", key);
}

function toIntOrNull(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function getDecrypted(encKey: string): Promise<string | null> {
  const enc = await getSetting(encKey);
  if (!enc || !isEncryptionConfigured()) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

export async function getRuntimeIntegrationsMasked(): Promise<{
  encryptionConfigured: boolean;
  hasMarketApiKey: boolean;
  hasFinnhubApiKey: boolean;
  hasOpenAiApiKey: boolean;
  hasWeatherApiKey: boolean;
  marketProvider: "alpha_vantage" | "finnhub";
  marketCacheTtlMs: number | null;
  rssMinRefreshMs: number | null;
  openAiModel: string | null;
  weatherFixedLocation: boolean | null;
  weatherLat: string | null;
  weatherLon: string | null;
  githubSyncExcludeForks: boolean | null;
  githubSyncExcludeArchived: boolean | null;
  githubApiUserAgent: string | null;
}> {
  const encOk = isEncryptionConfigured();
  const marketEnc = await getSetting(KEY_MARKET_API_KEY_ENC);
  const finnhubEnc = await getSetting(KEY_FINNHUB_API_KEY_ENC);
  const openAiEnc = await getSetting(KEY_OPENAI_API_KEY_ENC);
  const weatherEnc = await getSetting(KEY_WEATHER_API_KEY_ENC);
  const marketCacheTtlMs = toIntOrNull(await getSetting(KEY_MARKET_CACHE_TTL_MS));
  const rssMinRefreshMs = toIntOrNull(await getSetting(KEY_RSS_MIN_REFRESH_MS));
  const openAiModel = (await getSetting(KEY_OPENAI_MODEL))?.trim() || null;
  const hasMarketApiKey = Boolean(marketEnc) || Boolean(process.env.ALPHAVANTAGE_API_KEY?.trim());
  const hasFinnhubApiKey = Boolean(finnhubEnc) || Boolean(process.env.FINNHUB_API_KEY?.trim());
  const marketProviderRaw = (await getSetting(KEY_MARKET_PROVIDER))?.trim();
  let marketProvider: "alpha_vantage" | "finnhub" =
    marketProviderRaw === "finnhub" ? "finnhub" : "alpha_vantage";
  if (marketProvider === "finnhub" && !hasFinnhubApiKey && hasMarketApiKey) {
    marketProvider = "alpha_vantage";
  } else if (marketProvider === "alpha_vantage" && !hasMarketApiKey && hasFinnhubApiKey) {
    marketProvider = "finnhub";
  }
  const weatherFixedLocationRaw = (await getSetting(KEY_WEATHER_FIXED_LOCATION))?.trim();
  const weatherFixedLocation =
    weatherFixedLocationRaw == null
      ? null
      : weatherFixedLocationRaw === "true";
  const weatherLat = (await getSetting(KEY_WEATHER_LAT))?.trim() || null;
  const weatherLon = (await getSetting(KEY_WEATHER_LON))?.trim() || null;
  const githubSyncExcludeForksRaw = (await getSetting(KEY_GITHUB_SYNC_EXCLUDE_FORKS))?.trim();
  const githubSyncExcludeArchivedRaw = (await getSetting(KEY_GITHUB_SYNC_EXCLUDE_ARCHIVED))?.trim();
  const githubApiUserAgent = (await getSetting(KEY_GITHUB_API_USER_AGENT))?.trim() || null;

  const hasOpenAiApiKey = Boolean(openAiEnc) || Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasWeatherApiKey = Boolean(weatherEnc) || Boolean(process.env.WEATHER_API_KEY?.trim());

  return {
    encryptionConfigured: encOk,
    hasMarketApiKey,
    hasFinnhubApiKey,
    hasOpenAiApiKey,
    hasWeatherApiKey,
    marketProvider,
    marketCacheTtlMs,
    rssMinRefreshMs,
    openAiModel,
    weatherFixedLocation,
    weatherLat,
    weatherLon,
    githubSyncExcludeForks:
      githubSyncExcludeForksRaw == null ? null : githubSyncExcludeForksRaw !== "false",
    githubSyncExcludeArchived:
      githubSyncExcludeArchivedRaw == null ? null : githubSyncExcludeArchivedRaw !== "false",
    githubApiUserAgent,
  };
}

export type RuntimeIntegrationsPut = {
  marketApiKey?: string | null;
  clearMarketApiKey?: boolean;
  finnhubApiKey?: string | null;
  clearFinnhubApiKey?: boolean;
  openAiApiKey?: string | null;
  clearOpenAiApiKey?: boolean;
  weatherApiKey?: string | null;
  clearWeatherApiKey?: boolean;
  openAiModel?: string;
  marketProvider?: "alpha_vantage" | "finnhub";
  marketCacheTtlMs?: number | null;
  rssMinRefreshMs?: number | null;
  weatherFixedLocation?: boolean | null;
  weatherLat?: string | null;
  weatherLon?: string | null;
  githubSyncExcludeForks?: boolean | null;
  githubSyncExcludeArchived?: boolean | null;
  githubApiUserAgent?: string | null;
};

export async function saveRuntimeIntegrations(body: RuntimeIntegrationsPut): Promise<void> {
  await ensureEncryptionKeyConfigured();

  if (body.clearMarketApiKey) {
    await deleteSetting(KEY_MARKET_API_KEY_ENC);
  }
  if (body.clearFinnhubApiKey) {
    await deleteSetting(KEY_FINNHUB_API_KEY_ENC);
  }
  if (body.clearOpenAiApiKey) {
    await deleteSetting(KEY_OPENAI_API_KEY_ENC);
  }
  if (body.clearWeatherApiKey) {
    await deleteSetting(KEY_WEATHER_API_KEY_ENC);
  }

  if (body.marketApiKey !== undefined && body.marketApiKey !== null) {
    const t = String(body.marketApiKey).trim();
    if (t) {
      await setSetting(KEY_MARKET_API_KEY_ENC, encryptSecret(t));
    }
  }
  if (body.finnhubApiKey !== undefined && body.finnhubApiKey !== null) {
    const t = String(body.finnhubApiKey).trim();
    if (t) {
      await setSetting(KEY_FINNHUB_API_KEY_ENC, encryptSecret(t));
    }
  }
  if (body.openAiApiKey !== undefined && body.openAiApiKey !== null) {
    const t = String(body.openAiApiKey).trim();
    if (t) {
      await setSetting(KEY_OPENAI_API_KEY_ENC, encryptSecret(t));
    }
  }
  if (body.weatherApiKey !== undefined && body.weatherApiKey !== null) {
    const t = String(body.weatherApiKey).trim();
    if (t) {
      await setSetting(KEY_WEATHER_API_KEY_ENC, encryptSecret(t));
    }
  }

  if (body.openAiModel !== undefined) {
    const m = String(body.openAiModel).trim();
    if (m) await setSetting(KEY_OPENAI_MODEL, m.slice(0, 80));
    else await deleteSetting(KEY_OPENAI_MODEL);
  }
  if (body.marketProvider !== undefined) {
    await setSetting(KEY_MARKET_PROVIDER, body.marketProvider === "finnhub" ? "finnhub" : "alpha_vantage");
  }

  if (body.marketCacheTtlMs !== undefined) {
    if (body.marketCacheTtlMs === null) {
      await deleteSetting(KEY_MARKET_CACHE_TTL_MS);
    } else {
      await setSetting(KEY_MARKET_CACHE_TTL_MS, String(Math.max(30_000, Math.trunc(body.marketCacheTtlMs))));
    }
  }

  if (body.rssMinRefreshMs !== undefined) {
    if (body.rssMinRefreshMs === null) {
      await deleteSetting(KEY_RSS_MIN_REFRESH_MS);
    } else {
      await setSetting(KEY_RSS_MIN_REFRESH_MS, String(Math.max(60_000, Math.trunc(body.rssMinRefreshMs))));
    }
  }

  if (body.weatherFixedLocation !== undefined) {
    if (body.weatherFixedLocation === null) await deleteSetting(KEY_WEATHER_FIXED_LOCATION);
    else await setSetting(KEY_WEATHER_FIXED_LOCATION, body.weatherFixedLocation ? "true" : "false");
  }
  if (body.weatherLat !== undefined) {
    const v = body.weatherLat == null ? "" : String(body.weatherLat).trim();
    if (!v) await deleteSetting(KEY_WEATHER_LAT);
    else await setSetting(KEY_WEATHER_LAT, v.slice(0, 30));
  }
  if (body.weatherLon !== undefined) {
    const v = body.weatherLon == null ? "" : String(body.weatherLon).trim();
    if (!v) await deleteSetting(KEY_WEATHER_LON);
    else await setSetting(KEY_WEATHER_LON, v.slice(0, 30));
  }

  if (body.githubSyncExcludeForks !== undefined) {
    if (body.githubSyncExcludeForks === null) await deleteSetting(KEY_GITHUB_SYNC_EXCLUDE_FORKS);
    else await setSetting(KEY_GITHUB_SYNC_EXCLUDE_FORKS, body.githubSyncExcludeForks ? "true" : "false");
  }
  if (body.githubSyncExcludeArchived !== undefined) {
    if (body.githubSyncExcludeArchived === null) await deleteSetting(KEY_GITHUB_SYNC_EXCLUDE_ARCHIVED);
    else await setSetting(KEY_GITHUB_SYNC_EXCLUDE_ARCHIVED, body.githubSyncExcludeArchived ? "true" : "false");
  }
  if (body.githubApiUserAgent !== undefined) {
    const v = body.githubApiUserAgent == null ? "" : String(body.githubApiUserAgent).trim();
    if (!v) await deleteSetting(KEY_GITHUB_API_USER_AGENT);
    else await setSetting(KEY_GITHUB_API_USER_AGENT, v.slice(0, 160));
  }
}

export async function getRuntimeIntegrationsResolved(): Promise<{
  marketApiKey: string | null;
  finnhubApiKey: string | null;
  weatherApiKey: string | null;
  openAiApiKey: string | null;
  openAiModel: string;
  marketProvider: "alpha_vantage" | "finnhub";
  marketCacheTtlMs: number;
  rssMinRefreshMs: number;
  weatherFixedLocation: boolean;
  weatherLat: string | null;
  weatherLon: string | null;
  githubSyncExcludeForks: boolean;
  githubSyncExcludeArchived: boolean;
  githubApiUserAgent: string;
}> {
  const marketApiKey = (await getDecrypted(KEY_MARKET_API_KEY_ENC)) || process.env.ALPHAVANTAGE_API_KEY?.trim() || null;
  const finnhubApiKey = (await getDecrypted(KEY_FINNHUB_API_KEY_ENC)) || process.env.FINNHUB_API_KEY?.trim() || null;
  const weatherApiKey = (await getDecrypted(KEY_WEATHER_API_KEY_ENC)) || process.env.WEATHER_API_KEY?.trim() || null;
  const openAiApiKey = (await getDecrypted(KEY_OPENAI_API_KEY_ENC)) || process.env.OPENAI_API_KEY?.trim() || null;
  const openAiModel = (await getSetting(KEY_OPENAI_MODEL))?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const marketProviderRaw = (await getSetting(KEY_MARKET_PROVIDER))?.trim();
  let marketProvider: "alpha_vantage" | "finnhub" =
    marketProviderRaw === "finnhub" ? "finnhub" : "alpha_vantage";
  if (marketProvider === "finnhub" && !finnhubApiKey && marketApiKey) {
    marketProvider = "alpha_vantage";
  } else if (marketProvider === "alpha_vantage" && !marketApiKey && finnhubApiKey) {
    marketProvider = "finnhub";
  }
  const marketCacheTtlMs = Math.max(
    30_000,
    toIntOrNull(await getSetting(KEY_MARKET_CACHE_TTL_MS)) ??
      Number(process.env.MARKET_CACHE_TTL_MS ?? 5 * 60 * 1000),
  );
  const rssMinRefreshMs = Math.max(
    60_000,
    toIntOrNull(await getSetting(KEY_RSS_MIN_REFRESH_MS)) ??
      Number(process.env.RSS_MIN_REFRESH_MS ?? 10 * 60 * 1000),
  );
  const weatherFixedRaw = (await getSetting(KEY_WEATHER_FIXED_LOCATION))?.trim();
  const weatherFixedLocation =
    weatherFixedRaw != null ? weatherFixedRaw === "true" : process.env.WEATHER_FIXED_LOCATION === "true";
  const weatherLat = (await getSetting(KEY_WEATHER_LAT))?.trim() || process.env.WEATHER_LAT?.trim() || null;
  const weatherLon = (await getSetting(KEY_WEATHER_LON))?.trim() || process.env.WEATHER_LON?.trim() || null;
  const githubSyncExcludeForksRaw = (await getSetting(KEY_GITHUB_SYNC_EXCLUDE_FORKS))?.trim();
  const githubSyncExcludeArchivedRaw = (await getSetting(KEY_GITHUB_SYNC_EXCLUDE_ARCHIVED))?.trim();
  const githubApiUserAgent = (await getSetting(KEY_GITHUB_API_USER_AGENT))?.trim() || process.env.GITHUB_API_USER_AGENT?.trim() || "AlruscoPortfolio/1.0 (github sync)";

  return {
    marketApiKey,
    finnhubApiKey,
    weatherApiKey,
    openAiApiKey,
    openAiModel,
    marketProvider,
    marketCacheTtlMs,
    rssMinRefreshMs,
    weatherFixedLocation,
    weatherLat,
    weatherLon,
    githubSyncExcludeForks:
      githubSyncExcludeForksRaw != null
        ? githubSyncExcludeForksRaw !== "false"
        : process.env.GITHUB_SYNC_EXCLUDE_FORKS !== "false",
    githubSyncExcludeArchived:
      githubSyncExcludeArchivedRaw != null
        ? githubSyncExcludeArchivedRaw !== "false"
        : process.env.GITHUB_SYNC_EXCLUDE_ARCHIVED !== "false",
    githubApiUserAgent,
  };
}

