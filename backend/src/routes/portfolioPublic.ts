import { Router } from "express";
import { getDb } from "../auth/userStore";
import { FALLBACK_PORTFOLIO, PORTFOLIO_SETTINGS_KEY } from "../utils/portfolioDefaults";
import { mergeWithFallback, sanitizePortfolioForPublic } from "../utils/portfolioMerge";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const db = await getDb();
    const row = await db.get<{ value: string } | undefined>(
      "SELECT value FROM settings WHERE key = ?",
      PORTFOLIO_SETTINGS_KEY,
    );

    if (!row) {
      return res.json(sanitizePortfolioForPublic(FALLBACK_PORTFOLIO));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value) as unknown;
    } catch {
      return res.json(sanitizePortfolioForPublic(FALLBACK_PORTFOLIO));
    }

    const merged = mergeWithFallback(parsed);
    return res.json(sanitizePortfolioForPublic(merged));
  } catch {
    return res.status(500).json({ error: "failed to load portfolio" });
  }
});

export default router;
