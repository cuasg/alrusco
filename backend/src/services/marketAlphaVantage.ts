import { getDb } from "../auth/userStore";
import { getRuntimeIntegrationsResolved } from "./runtimeIntegrations";

const BASE_URL = "https://www.alphavantage.co/query";

type CacheRow = { fetched_at: string; payload_json: string };

async function readCache(cacheKey: string): Promise<CacheRow | null> {
  const db = await getDb();
  const row = await db.get<CacheRow | undefined>(
    "SELECT fetched_at, payload_json FROM market_cache WHERE cache_key = ?",
    cacheKey,
  );
  return row ?? null;
}

async function writeCache(cacheKey: string, payloadJson: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `
      INSERT INTO market_cache (cache_key, fetched_at, payload_json)
      VALUES (?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        payload_json = excluded.payload_json
    `,
    cacheKey,
    new Date().toISOString(),
    payloadJson,
  );
}

function isFresh(fetchedAt: string, ttlMs: number): boolean {
  const t = new Date(fetchedAt).valueOf();
  return Number.isFinite(t) && Date.now() - t < ttlMs;
}

function isAlphaVantageMetaErrorPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.Note === "string" ||
    typeof p.Information === "string" ||
    typeof p["Error Message"] === "string"
  );
}

async function avFetch(apiKey: string | null, params: Record<string, string>): Promise<unknown> {
  if (!apiKey) {
    throw new Error("ALPHAVANTAGE_API_KEY not configured");
  }
  const qs = new URLSearchParams({ ...params, apikey: apiKey });
  const url = `${BASE_URL}?${qs.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "alrusco/1.0 (market)" },
  });
  if (!res.ok) {
    throw new Error(`alpha vantage error ${res.status}`);
  }
  return (await res.json()) as unknown;
}

export type Quote = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  asOf?: string;
};

async function finnhubQuoteFetch(apiKey: string | null, symbol: string): Promise<Quote> {
  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY not configured");
  }
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { "User-Agent": "alrusco/1.0 (market)" } });
  if (!res.ok) {
    throw new Error(`finnhub error ${res.status}`);
  }
  const json = (await res.json()) as {
    c?: number;
    d?: number;
    dp?: number;
    t?: number;
  };
  return {
    symbol,
    price: Number.isFinite(json.c) ? Number(json.c) : null,
    change: Number.isFinite(json.d) ? Number(json.d) : null,
    changePercent: Number.isFinite(json.dp) ? Number(json.dp) : null,
    asOf: Number.isFinite(json.t) ? new Date(Number(json.t) * 1000).toISOString().slice(0, 10) : undefined,
  };
}

function emptyQuote(symbol: string): Quote {
  return { symbol, price: null, change: null, changePercent: null };
}

export async function getQuote(symbolRaw: string): Promise<Quote> {
  const runtime = await getRuntimeIntegrationsResolved();
  const symbol = symbolRaw.trim().toUpperCase().slice(0, 16);
  const cacheKey = `quote:${runtime.marketProvider}:${symbol}`;
  const cached = await readCache(cacheKey);
  if (cached && isFresh(cached.fetched_at, runtime.marketCacheTtlMs)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(cached.payload_json);
    } catch {
      parsed = null;
    }
    if (parsed != null) {
      if (runtime.marketProvider === "finnhub") {
        return parsed as Quote;
      }
      if (!isAlphaVantageMetaErrorPayload(parsed)) {
        return parseQuotePayload(symbol, parsed);
      }
    }
  }

  if (runtime.marketProvider === "finnhub") {
    if (!runtime.finnhubApiKey) return emptyQuote(symbol);
    try {
      const q = await finnhubQuoteFetch(runtime.finnhubApiKey, symbol);
      await writeCache(cacheKey, JSON.stringify(q));
      return q;
    } catch {
      return emptyQuote(symbol);
    }
  }

  if (!runtime.marketApiKey) return emptyQuote(symbol);
  try {
    const payload = await avFetch(runtime.marketApiKey, { function: "GLOBAL_QUOTE", symbol });
    if (!isAlphaVantageMetaErrorPayload(payload)) {
      await writeCache(cacheKey, JSON.stringify(payload));
    }
    return parseQuotePayload(symbol, payload);
  } catch {
    return emptyQuote(symbol);
  }
}

function parseQuotePayload(symbol: string, payload: any): Quote {
  const q = payload?.["Global Quote"] ?? payload?.["GlobalQuote"] ?? null;
  const price = Number(q?.["05. price"] ?? q?.price);
  const change = Number(q?.["09. change"] ?? q?.change);
  const changePercentRaw = typeof q?.["10. change percent"] === "string" ? q["10. change percent"] : q?.changePercent;
  const changePercent = typeof changePercentRaw === "string"
    ? Number(changePercentRaw.replace("%", ""))
    : Number(changePercentRaw);
  const asOf = typeof q?.["07. latest trading day"] === "string" ? q["07. latest trading day"] : undefined;

  return {
    symbol,
    price: Number.isFinite(price) ? price : null,
    change: Number.isFinite(change) ? change : null,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    asOf,
  };
}

export type SymbolSearchHit = {
  symbol: string;
  name: string;
  exchange?: string;
};

const SEARCH_CACHE_MS = 45_000;
const searchMemCache = new Map<string, { at: number; hits: SymbolSearchHit[] }>();

function searchCacheKey(provider: string, q: string): string {
  return `${provider}:${q.toLowerCase().trim().slice(0, 80)}`;
}

async function finnhubSymbolSearch(apiKey: string | null, q: string, limit: number): Promise<SymbolSearchHit[]> {
  if (!apiKey) return [];
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { "User-Agent": "alrusco/1.0 (market search)" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { result?: Array<{ symbol?: string; displaySymbol?: string; description?: string }> };
  const rows = Array.isArray(json.result) ? json.result : [];
  const hits: SymbolSearchHit[] = [];
  for (const row of rows.slice(0, limit)) {
    const sym = (row.displaySymbol || row.symbol || "").trim();
    const name = (row.description || sym).trim().slice(0, 160);
    if (!sym) continue;
    hits.push({ symbol: sym.toUpperCase().slice(0, 32), name: name || sym });
  }
  return hits;
}

async function alphaSymbolSearch(apiKey: string | null, q: string, limit: number): Promise<SymbolSearchHit[]> {
  if (!apiKey) return [];
  const payload = (await avFetch(apiKey, { function: "SYMBOL_SEARCH", keywords: q.slice(0, 80) })) as any;
  const matches = Array.isArray(payload?.bestMatches) ? payload.bestMatches : [];
  const hits: SymbolSearchHit[] = [];
  for (const m of matches.slice(0, limit)) {
    const sym = typeof m?.["1. symbol"] === "string" ? m["1. symbol"].trim() : "";
    const name = typeof m?.["2. name"] === "string" ? m["2. name"].trim() : sym;
    const region = typeof m?.["4. region"] === "string" ? m["4. region"].trim() : "";
    if (!sym) continue;
    hits.push({
      symbol: sym.toUpperCase().slice(0, 32),
      name: name.slice(0, 160),
      ...(region ? { exchange: region } : {}),
    });
  }
  return hits;
}

/**
 * Ticker typeahead — uses the configured market quote provider’s search API.
 */
export async function searchSymbols(keywordsRaw: string, limit = 10): Promise<SymbolSearchHit[]> {
  const q = keywordsRaw.trim().slice(0, 80);
  if (q.length < 1) return [];
  const lim = Math.min(20, Math.max(1, Math.floor(limit)));

  const runtime = await getRuntimeIntegrationsResolved();
  const ck = searchCacheKey(runtime.marketProvider, q);
  const cached = searchMemCache.get(ck);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_MS) {
    return cached.hits;
  }

  let hits: SymbolSearchHit[] = [];
  if (runtime.marketProvider === "finnhub") {
    hits = await finnhubSymbolSearch(runtime.finnhubApiKey, q, lim);
  } else {
    hits = await alphaSymbolSearch(runtime.marketApiKey, q, lim);
  }

  searchMemCache.set(ck, { at: Date.now(), hits });
  return hits;
}
