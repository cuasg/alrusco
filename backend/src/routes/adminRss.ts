import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../auth/authMiddleware";
import { getRssFeeds, saveRssFeeds, type RssFeedDef } from "../services/rssCache";
import { getDb } from "../auth/userStore";

const router = Router();
router.use(requireAuth);

const rssAdminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: Number(process.env.RSS_ADMIN_RATE_LIMIT_MAX ?? "30"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "too many rss admin requests, try again later" },
});

router.get("/feeds", rssAdminLimiter, async (_req, res) => {
  const feeds = await getRssFeeds();
  res.json({ feeds });
});

router.put("/feeds", rssAdminLimiter, async (req, res) => {
  const body = req.body as unknown;
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: "expected an array of feeds" });
  }

  const feeds = body as RssFeedDef[];
  await saveRssFeeds(feeds);
  return res.json({ ok: true });
});

const BOOKMARKS_KEY = "rss.bookmarks";

router.get("/bookmarks", rssAdminLimiter, async (_req, res) => {
  try {
    const db = await getDb();
    const row = await db.get<{ value: string } | undefined>(
      "SELECT value FROM settings WHERE key = ?",
      BOOKMARKS_KEY,
    );
    if (!row) return res.json({ ids: [] });
    const parsed = JSON.parse(row.value) as unknown;
    const ids = Array.isArray(parsed)
      ? parsed
          .filter((x) => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 2000)
      : [];
    return res.json({ ids });
  } catch {
    return res.status(500).json({ error: "failed to load bookmarks" });
  }
});

router.put("/bookmarks", rssAdminLimiter, async (req, res) => {
  const body = req.body as unknown;
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: "expected an array of ids" });
  }
  const ids = body
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 2000);

  try {
    const db = await getDb();
    await db.run(
      `
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      BOOKMARKS_KEY,
      JSON.stringify(ids),
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "failed to save bookmarks" });
  }
});

export default router;

