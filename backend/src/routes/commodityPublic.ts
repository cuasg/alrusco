import { Router } from "express";
import type { Request, Response } from "express";

/**
 * Server-side fetch for the US commodity tracker static page.
 * Browsers cannot call Yahoo Finance / metals.live directly (CORS); public CORS proxies are unreliable (403/429).
 */
const ALLOWED_YAHOO_SYMBOLS = new Set([
  "GC=F",
  "SI=F",
  "PL=F",
  "CL=F",
  "BZ=F",
  "NG=F",
  "HG=F",
  "ALI=F",
  "ZN=F",
  "JJN",
  "LED=F",
  /** Invesco DB Base Metals Fund — used as liquid proxy for daily % when COMEX lead (LED=F) is static on Yahoo. */
  "DBB",
]);

function isSafeYahooParam(s: string): boolean {
  return /^[0-9A-Za-z.]+$/.test(s);
}

const router = Router();

router.get("/yahoo", async (req: Request, res: Response) => {
  const symbol = String(req.query.symbol ?? "").trim();
  const range = String(req.query.range ?? "1d").trim();
  const interval = String(req.query.interval ?? "1d").trim();

  if (!ALLOWED_YAHOO_SYMBOLS.has(symbol)) {
    res.status(400).json({ error: "Invalid symbol" });
    return;
  }
  if (!isSafeYahooParam(range) || !isSafeYahooParam(interval)) {
    res.status(400).json({ error: "Invalid range or interval" });
    return;
  }

  const upstream = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;

  try {
    const r = await fetch(upstream, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; alrusco-commodities/1.0)",
        Accept: "application/json,text/plain,*/*",
      },
    });
    if (!r.ok) {
      res.status(502).json({ error: "Upstream Yahoo error", status: r.status });
      return;
    }
    const data = (await r.json()) as unknown;
    res.setHeader("Cache-Control", "public, max-age=15");
    res.json(data);
  } catch {
    res.status(502).json({ error: "Upstream fetch failed" });
  }
});

const METALS_SPOT_URL = "https://metals.live/api/v1/spot";
const METALS_FETCH_MS = 12_000;

router.get("/metals-spot", async (_req: Request, res: Response) => {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), METALS_FETCH_MS);
  try {
    const r = await fetch(METALS_SPOT_URL, {
      signal: ac.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(to);
    if (!r.ok) {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.setHeader("X-Alrusco-Metals-Spot", "unavailable");
      res.json([] as unknown[]);
      return;
    }
    const data = (await r.json()) as unknown;
    res.setHeader("Cache-Control", "public, max-age=30");
    res.setHeader("X-Alrusco-Metals-Spot", "ok");
    res.json(data);
  } catch {
    clearTimeout(to);
    /** Empty array: clients use local approx fallback for LME metals — avoids 502 spam when upstream is down. */
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("X-Alrusco-Metals-Spot", "unavailable");
    res.json([] as unknown[]);
  }
});

export default router;
