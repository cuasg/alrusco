import path from "path";
import fs from "fs";
import multer from "multer";
import sharp from "sharp";
import { Router } from "express";
import { getDb } from "../auth/userStore";
import { requireAuth } from "../auth/authMiddleware";
import { sanitizeTextForDisplay } from "../utils/sanitize";
import {
  FALLBACK_PORTFOLIO,
  PORTFOLIO_SECTION_KEYS,
  PORTFOLIO_SETTINGS_KEY,
  type PortfolioSectionKey,
  type PortfolioStored,
} from "../utils/portfolioDefaults";
import { sanitizePortfolioForPublic } from "../utils/portfolioMerge";
import { getUploadsRoot } from "../utils/dataDir";

const router = Router();

router.use(requireAuth);

const MAX_PORTFOLIO_JSON_BYTES = Number(process.env.PORTFOLIO_JSON_LIMIT ?? "400000");
const MAX_SECTION_HTML = 120_000;
const MAX_DISPLAY_NAME = 200;

const UPLOAD_ROOT = getUploadsRoot();
const PORTFOLIO_DIR = path.join(UPLOAD_ROOT, "portfolio");

for (const dir of [PORTFOLIO_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOAD_ROOT, "originals"));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      cb(null, `portfolio-src-${unique}${ext.toLowerCase()}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",
    ]);
    if (!allowed.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, WebP, GIF, or HEIC/HEIF uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

function normalizeIncomingPortfolio(body: unknown): { data?: PortfolioStored; errors?: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { errors: ["payload must be an object"] };
  }

  const b = body as Partial<PortfolioStored>;

  let displayName = FALLBACK_PORTFOLIO.displayName;
  if (typeof b.displayName === "string") {
    const raw = b.displayName.trim();
    if (raw.length > MAX_DISPLAY_NAME) {
      errors.push(`displayName too long (max ${MAX_DISPLAY_NAME})`);
    } else {
      displayName = raw;
    }
  }

  let headshotUrl: string | null = FALLBACK_PORTFOLIO.headshotUrl;
  if (b.headshotUrl === null) {
    headshotUrl = null;
  } else if (typeof b.headshotUrl === "string") {
    const t = b.headshotUrl.trim();
    if (!t) {
      headshotUrl = null;
    } else if (t.length > 500) {
      errors.push("headshotUrl too long");
    } else if (!/^(https?:\/\/|\/)/i.test(t)) {
      errors.push("headshotUrl must start with https://, http://, or /");
    } else {
      headshotUrl = t;
    }
  }

  const sections = { ...FALLBACK_PORTFOLIO.sections };
  if (!b.sections || typeof b.sections !== "object") {
    errors.push("sections object is required");
  } else {
    const incoming = b.sections as Partial<Record<PortfolioSectionKey, unknown>>;
    for (const key of PORTFOLIO_SECTION_KEYS) {
      const v = incoming[key];
      if (v === undefined) {
        continue;
      }
      if (typeof v !== "string") {
        errors.push(`sections.${key} must be a string`);
        continue;
      }
      if (v.length > MAX_SECTION_HTML) {
        errors.push(`sections.${key} too long (max ${MAX_SECTION_HTML} chars)`);
        continue;
      }
      sections[key] = v;
    }
  }

  if (errors.length) {
    return { errors };
  }

  const sanitized = sanitizePortfolioForPublic({
    displayName,
    headshotUrl,
    sections,
  });

  return { data: sanitized };
}

router.post("/sanitize", (req, res) => {
  const html = (req.body as { html?: unknown })?.html;
  if (typeof html !== "string") {
    return res.status(400).json({ error: "html string is required" });
  }
  if (html.length > MAX_SECTION_HTML) {
    return res.status(400).json({ error: `html too long (max ${MAX_SECTION_HTML})` });
  }
  return res.json({ html: sanitizeTextForDisplay(html) });
});

router.put("/", async (req, res) => {
  const body = req.body as unknown;

  try {
    const size = JSON.stringify(body).length;
    if (size > MAX_PORTFOLIO_JSON_BYTES) {
      return res.status(400).json({
        error: `payload too large (max ${MAX_PORTFOLIO_JSON_BYTES} bytes)`,
      });
    }
  } catch {
    return res.status(400).json({ error: "invalid JSON body" });
  }

  const { data, errors } = normalizeIncomingPortfolio(body);
  if (!data || (errors && errors.length)) {
    return res.status(400).json({ error: errors?.join(", ") || "invalid portfolio payload" });
  }

  try {
    const db = await getDb();
    await db.run(
      `
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      PORTFOLIO_SETTINGS_KEY,
      JSON.stringify(data),
    );

    return res.json({ ok: true, portfolio: data });
  } catch {
    return res.status(500).json({ error: "failed to save portfolio" });
  }
});

router.post(
  "/headshot",
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "upload failed";
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file?.path) {
      return res.status(400).json({ error: "file is required" });
    }

    const outName = `headshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const outPath = path.join(PORTFOLIO_DIR, outName);
    const publicUrl = `/uploads/portfolio/${outName}`;

    try {
      await sharp(file.path)
        .rotate()
        .resize(720, 720, { fit: "cover", position: "attention" })
        .webp({ quality: 86 })
        .toFile(outPath);
    } catch (err) {
      await fs.promises.unlink(file.path).catch(() => {});
      await fs.promises.unlink(outPath).catch(() => {});
      // eslint-disable-next-line no-console
      console.error("portfolio headshot processing failed", err);
      return res.status(400).json({ error: "could not process image" });
    }

    await fs.promises.unlink(file.path).catch(() => {});

    return res.status(201).json({ url: publicUrl });
  },
);

export default router;
