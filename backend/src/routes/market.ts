import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getQuote, searchSymbols, type Quote } from "../services/marketAlphaVantage";
import { getDb } from "../auth/userStore";
import { requireAuth } from "../auth/authMiddleware";
import { getRuntimeIntegrationsResolved } from "../services/runtimeIntegrations";

const router = Router();

const marketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.MARKET_RATE_LIMIT_MAX ?? "60"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "too many market requests, try again later" },
});

const symbolSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.MARKET_SEARCH_RATE_LIMIT_MAX ?? "30"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "too many symbol searches, try again later" },
});

router.get("/search", symbolSearchLimiter, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
  const limit = Number.isFinite(limRaw) ? Math.min(20, Math.max(1, Math.floor(limRaw))) : 10;
  if (!q.trim()) {
    return res.json({ hits: [] });
  }
  try {
    const hits = await searchSymbols(q, limit);
    return res.json({ hits });
  } catch {
    return res.status(500).json({ error: "symbol search failed" });
  }
});

router.get("/quote", marketLimiter, async (req, res) => {
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol : "";
  if (!symbol.trim()) return res.status(400).json({ error: "symbol required" });
  try {
    const quote = await getQuote(symbol);
    return res.json({ quote });
  } catch {
    return res.status(500).json({ error: "failed to fetch quote" });
  }
});

/** One request for many symbols (single rate-limit hit); used by the dashboard market tile. */
router.get("/quotes", marketLimiter, async (req, res) => {
  const raw = typeof req.query.symbols === "string" ? req.query.symbols : "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30);
  if (symbols.length === 0) return res.json({ quotes: {} as Record<string, Quote> });
  try {
    const list = await Promise.all(symbols.map((symbol) => getQuote(symbol)));
    const out: Record<string, Quote> = {};
    symbols.forEach((sym, i) => {
      out[sym] = list[i]!;
    });
    return res.json({ quotes: out });
  } catch {
    return res.status(500).json({ error: "failed to fetch quotes" });
  }
});

/** Owner-only: why live prices might be missing (no secrets exposed). */
router.get("/diagnostics", requireAuth, async (_req, res) => {
  try {
    const r = await getRuntimeIntegrationsResolved();
    const quoteReady =
      r.marketProvider === "finnhub" ? Boolean(r.finnhubApiKey) : Boolean(r.marketApiKey);
    let hint: string | null = null;
    if (!quoteReady) {
      hint =
        "No API key for the active quote provider. Open Settings → Integrations: choose Market provider (Finnhub vs Alpha Vantage) and save the matching API key (or set ALPHAVANTAGE_API_KEY / FINNHUB_API_KEY in server env).";
    }
    return res.json({
      effectiveQuoteProvider: r.marketProvider,
      hasAlphaVantageKey: Boolean(r.marketApiKey),
      hasFinnhubKey: Boolean(r.finnhubApiKey),
      quoteIntegrationReady: quoteReady,
      hint,
    });
  } catch {
    return res.status(500).json({ error: "diagnostics failed" });
  }
});

const WATCHLIST_KEY = "market.watchlist";

function watchlistStorageKey(forUserId: number | null): string {
  if (forUserId == null) return WATCHLIST_KEY;
  return `market.watchlist.u${forUserId}`;
}

type AppDb = Awaited<ReturnType<typeof getDb>>;

async function ensureUserWatchlistMigrated(db: AppDb, userId: number): Promise<void> {
  const userKey = watchlistStorageKey(userId);
  const existing = await db.get<{ value: string } | undefined>("SELECT value FROM settings WHERE key = ?", userKey);
  if (existing?.value) return;
  const legacy = await db.get<{ value: string } | undefined>("SELECT value FROM settings WHERE key = ?", WATCHLIST_KEY);
  if (legacy?.value) {
    await db.run(
      `
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      userKey,
      legacy.value,
    );
  }
}

router.get("/watchlist", requireAuth, async (req, res) => {
  const userId = (req as { user?: { id: number } }).user!.id;
  try {
    const db = await getDb();
    await ensureUserWatchlistMigrated(db, userId);
    const row = await db.get<{ value: string } | undefined>(
      "SELECT value FROM settings WHERE key = ?",
      watchlistStorageKey(userId),
    );
    if (!row) return res.json({ tickers: ["SPY", "QQQ"] });
    const parsed = JSON.parse(row.value) as unknown;
    const tickers = Array.isArray(parsed)
      ? parsed.filter((t) => typeof t === "string").map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 30)
      : ["SPY", "QQQ"];
    return res.json({ tickers });
  } catch {
    return res.status(500).json({ error: "failed to load watchlist" });
  }
});

router.put("/watchlist", requireAuth, async (req, res) => {
  const userId = (req as { user?: { id: number } }).user!.id;
  const body = req.body as unknown;
  if (!Array.isArray(body)) return res.status(400).json({ error: "expected array of tickers" });
  const tickers = body
    .filter((t) => typeof t === "string")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30);

  try {
    const db = await getDb();
    await db.run(
      `
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      watchlistStorageKey(userId),
      JSON.stringify(tickers),
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "failed to save watchlist" });
  }
});

export default router;
