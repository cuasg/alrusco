import { Router } from "express";
import { getDb } from "../auth/userStore";
import { requireAuth } from "../auth/authMiddleware";
import { sanitizeTextForDisplay } from "../utils/sanitize";

const router = Router();

router.use(requireAuth);

const HOME_SETTINGS_KEY = "homepage";
const MAX_HOME_PAYLOAD_BYTES = 32 * 1024; // 32KB

type HomeHighlight = {
  title: string;
  description: string;
};

type HomeConfig = {
  eyebrow: string;
  heading: string;
  tagline: string;
  highlights: HomeHighlight[];
  bannerImageUrl?: string | null;
};

const MAX_HOME_TEXT = 500;
const MAX_HIGHLIGHT_TITLE = 120;
const MAX_HIGHLIGHT_DESC = 400;
const MAX_HIGHLIGHTS = 8;
const MAX_BANNER_URL = 500;

function normalizeHomeConfig(input: unknown): { config?: HomeConfig; errors?: string[] } {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { errors: ["settings payload must be an object"] };
  }

  const value = input as Partial<HomeConfig>;

  function cleanText(text: unknown, max: number, fieldName: string): string {
    if (typeof text !== "string") {
      errors.push(`${fieldName} is required`);
      return "";
    }
    const trimmed = text.trim();
    if (!trimmed) {
      errors.push(`${fieldName} is required`);
      return "";
    }
    if (trimmed.length > max) {
      errors.push(`${fieldName} too long (max ${max} chars)`);
    }
    return trimmed.slice(0, max);
  }

  const eyebrowRaw = cleanText(value.eyebrow, MAX_HOME_TEXT, "eyebrow");
  const headingRaw = cleanText(value.heading, MAX_HOME_TEXT, "heading");
  const taglineRaw = cleanText(value.tagline, MAX_HOME_TEXT, "tagline");
  const eyebrow = sanitizeTextForDisplay(eyebrowRaw);
  const heading = sanitizeTextForDisplay(headingRaw);
  const tagline = sanitizeTextForDisplay(taglineRaw);

  const rawHighlights = Array.isArray(value.highlights) ? value.highlights : [];
  if (rawHighlights.length === 0) {
    errors.push("at least one highlight is required");
  }

  const highlights: HomeHighlight[] = rawHighlights
    .slice(0, MAX_HIGHLIGHTS)
    .map((h, index) => {
      const title = typeof h?.title === "string" ? h.title.trim() : "";
      const description = typeof h?.description === "string" ? h.description.trim() : "";

      if (!title && !description) {
        return null;
      }

      const safeTitle = sanitizeTextForDisplay(
        title.length > MAX_HIGHLIGHT_TITLE
          ? title.slice(0, MAX_HIGHLIGHT_TITLE)
          : title,
      );
      const safeDescription = sanitizeTextForDisplay(
        description.length > MAX_HIGHLIGHT_DESC
          ? description.slice(0, MAX_HIGHLIGHT_DESC)
          : description,
      );

      if (!safeTitle && !safeDescription) {
        return null;
      }

      return {
        title: safeTitle,
        description: safeDescription,
      };
    })
    .filter((h): h is HomeHighlight => h !== null);

  if (!highlights.length) {
    errors.push("at least one non-empty highlight is required");
  }

  const safeBannerUrl = (url: string): boolean =>
    /^(https?:\/\/|\/)/i.test(url);

  let bannerImageUrl: string | null | undefined = null;
  if (value.bannerImageUrl !== undefined && value.bannerImageUrl !== null) {
    if (typeof value.bannerImageUrl !== "string") {
      errors.push("bannerImageUrl must be a string or null");
    } else {
      const trimmed = value.bannerImageUrl.trim();
      if (trimmed) {
        if (trimmed.length > MAX_BANNER_URL) {
          errors.push(`bannerImageUrl too long (max ${MAX_BANNER_URL} chars)`);
        } else if (!safeBannerUrl(trimmed)) {
          errors.push("bannerImageUrl must start with https://, http://, or /");
        } else {
          bannerImageUrl = trimmed.slice(0, MAX_BANNER_URL);
        }
      } else {
        bannerImageUrl = null;
      }
    }
  }

  if (errors.length) {
    return { errors };
  }

  return {
    config: {
      eyebrow,
      heading,
      tagline,
      highlights,
      bannerImageUrl: bannerImageUrl ?? null,
    },
  };
}

router.put("/", async (req, res) => {
  const settings = req.body as unknown;

  if (settings === null || settings === undefined) {
    return res.status(400).json({ error: "settings payload is required" });
  }

  try {
    const payloadSize = JSON.stringify(settings).length;
    if (payloadSize > MAX_HOME_PAYLOAD_BYTES) {
      return res.status(400).json({
        error: `settings payload too large (max ${MAX_HOME_PAYLOAD_BYTES} bytes)`,
      });
    }
  } catch {
    return res.status(400).json({ error: "invalid settings payload" });
  }

  const { config, errors } = normalizeHomeConfig(settings);
  if (!config || (errors && errors.length)) {
    return res.status(400).json({ error: errors?.join(", ") || "invalid settings payload" });
  }

  try {
    const db = await getDb();
    const value = JSON.stringify(config);

    await db.run(
      `
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      HOME_SETTINGS_KEY,
      value,
    );

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to update home settings" });
  }
});

export default router;

