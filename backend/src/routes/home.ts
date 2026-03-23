import { Router } from "express";
import { getDb } from "../auth/userStore";

const router = Router();

const HOME_SETTINGS_KEY = "homepage";

type HomeHighlight = {
  title: string;
  description: string;
};

type HomeConfig = {
  eyebrow: string;
  heading: string;
  tagline: string;
  highlights: HomeHighlight[];
  bannerImageUrl: string | null;
};

const FALLBACK_HOME: HomeConfig = {
  eyebrow: "Homelab · Infrastructure · Applications",
  heading: "Designing reliable systems at home and at work.",
  tagline:
    "I build and operate secure, observable infrastructure in my homelab and in production. This site is both my portfolio and the front door to my personal tools.",
  highlights: [
    {
      title: "Infrastructure",
      description:
        "Clustered storage, virtualization, and networking designed for resilience, observability, and easy recovery.",
    },
    {
      title: "Applications",
      description:
        "Internal dashboards, automations, and tools that make day-to-day operations smoother and more transparent.",
    },
    {
      title: "Practice & learning",
      description:
        "Experiments, labs, and write-ups focused on doing things the right way instead of the quickest way.",
    },
  ],
  bannerImageUrl: null,
};

function sanitizeHomeConfig(value: unknown): HomeConfig {
  if (!value || typeof value !== "object") {
    return FALLBACK_HOME;
  }

  const v = value as Partial<HomeConfig>;

  const eyebrow =
    typeof v.eyebrow === "string" && v.eyebrow.trim()
      ? v.eyebrow.trim()
      : FALLBACK_HOME.eyebrow;
  const heading =
    typeof v.heading === "string" && v.heading.trim()
      ? v.heading.trim()
      : FALLBACK_HOME.heading;
  const tagline =
    typeof v.tagline === "string" && v.tagline.trim()
      ? v.tagline.trim()
      : FALLBACK_HOME.tagline;

  const rawHighlights = Array.isArray(v.highlights) ? v.highlights : FALLBACK_HOME.highlights;

  const highlights: HomeHighlight[] = rawHighlights
    .map((h) => {
      const title =
        typeof (h as any)?.title === "string"
          ? (h as any).title.trim()
          : "";
      const description =
        typeof (h as any)?.description === "string"
          ? (h as any).description.trim()
          : "";

      if (!title && !description) {
        return null;
      }

      return {
        title,
        description,
      };
    })
    .filter((h): h is HomeHighlight => h !== null);

  const safeHighlights = highlights.length ? highlights : FALLBACK_HOME.highlights;

  let bannerImageUrl: string | null = null;
  if (typeof v.bannerImageUrl === "string" && v.bannerImageUrl.trim()) {
    bannerImageUrl = v.bannerImageUrl.trim();
  }

  return {
    eyebrow,
    heading,
    tagline,
    highlights: safeHighlights,
    bannerImageUrl,
  };
}

router.get("/", async (_req, res) => {
  try {
    const db = await getDb();
    const row = await db.get<{ value: string } | undefined>(
      "SELECT value FROM settings WHERE key = ?",
      HOME_SETTINGS_KEY,
    );

    if (!row) {
      return res.json(FALLBACK_HOME);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value) as unknown;
    } catch {
      return res.json(FALLBACK_HOME);
    }

    const safeConfig = sanitizeHomeConfig(parsed);
    return res.json(safeConfig);
  } catch (err) {
    return res.status(500).json({ error: "failed to load home settings" });
  }
});

export default router;

