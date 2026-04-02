import { Router } from "express";
import { getAggregatedRssItems } from "../services/rssCache";

const router = Router();

router.get("/items", async (_req, res) => {
  try {
    const items = await getAggregatedRssItems();
    res.json({ items });
  } catch {
    res.status(500).json({ error: "failed to load rss items" });
  }
});

export default router;

