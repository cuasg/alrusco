import { randomUUID } from "crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../auth/authMiddleware";
import { getDb } from "../auth/userStore";
import { sanitizeTextForDisplay } from "../utils/sanitize";

const router = Router();
router.use(requireAuth);

const NOTES_KEY = "dashboard.notes";
const MAX_TOTAL_BYTES = 512 * 1024;
const MAX_NOTE_BODY = 48 * 1024;
const MAX_TITLE_LEN = 200;

export type SavedNote = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

type NotesPayloadV2 = { version: 2; items: SavedNote[] };

const notesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.NOTES_RATE_LIMIT_MAX ?? "60"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "too many notes requests, try again later" },
});

function clampTitle(raw: string): string {
  return sanitizeTextForDisplay(raw).slice(0, MAX_TITLE_LEN);
}

function clampBody(raw: string): string {
  return sanitizeTextForDisplay(raw).slice(0, MAX_NOTE_BODY);
}

function normalizeItems(raw: unknown): SavedNote[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedNote[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.title !== "string" || typeof o.body !== "string") continue;
    out.push({
      id: o.id.slice(0, 64),
      title: clampTitle(o.title),
      body: clampBody(o.body),
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    });
  }
  return out;
}

async function readRawRow(): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<{ value: string } | undefined>(
    "SELECT value FROM settings WHERE key = ?",
    NOTES_KEY,
  );
  return row?.value ?? null;
}

async function loadAndMigrate(): Promise<NotesPayloadV2> {
  const raw = await readRawRow();
  if (!raw) return { version: 2, items: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && (parsed as NotesPayloadV2).version === 2) {
      return { version: 2, items: normalizeItems((parsed as NotesPayloadV2).items) };
    }
    const legacyText = typeof (parsed as { text?: string })?.text === "string" ? (parsed as { text: string }).text : "";
    if (legacyText.trim()) {
      const migrated: NotesPayloadV2 = {
        version: 2,
        items: [
          {
            id: "migrated-" + randomUUID().slice(0, 8),
            title: "Scratchpad",
            body: clampBody(legacyText),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      await persistPayload(migrated);
      return migrated;
    }
  } catch {
    /* */
  }
  return { version: 2, items: [] };
}

async function persistPayload(data: NotesPayloadV2): Promise<void> {
  const json = JSON.stringify(data);
  if (json.length > MAX_TOTAL_BYTES) {
    throw new Error("payload too large");
  }
  const db = await getDb();
  await db.run(
    `
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    NOTES_KEY,
    json,
  );
}

router.get("/", notesLimiter, async (_req, res) => {
  try {
    const data = await loadAndMigrate();
    return res.json({ items: data.items });
  } catch {
    return res.status(500).json({ error: "failed to load notes" });
  }
});

router.post("/", notesLimiter, async (req, res) => {
  const body = req.body as { title?: string; body?: string };
  const title = clampTitle(typeof body?.title === "string" ? body.title : "Untitled");
  const noteBody = clampBody(typeof body?.body === "string" ? body.body : "");
  try {
    const data = await loadAndMigrate();
    const item: SavedNote = {
      id: randomUUID(),
      title: title || "Untitled",
      body: noteBody,
      updatedAt: new Date().toISOString(),
    };
    data.items = [item, ...data.items].slice(0, 200);
    await persistPayload(data);
    return res.json({ item });
  } catch (e) {
    if (e instanceof Error && e.message === "payload too large") {
      return res.status(400).json({ error: "notes storage full" });
    }
    return res.status(500).json({ error: "failed to save note" });
  }
});

router.put("/:id", notesLimiter, async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id.slice(0, 64) : "";
  if (!id) return res.status(400).json({ error: "invalid id" });
  const body = req.body as { title?: string; body?: string };
  try {
    const data = await loadAndMigrate();
    const idx = data.items.findIndex((x) => x.id === id);
    if (idx < 0) return res.status(404).json({ error: "not found" });
    const cur = data.items[idx];
    const title = typeof body?.title === "string" ? clampTitle(body.title) : cur.title;
    const noteBody = typeof body?.body === "string" ? clampBody(body.body) : cur.body;
    const item: SavedNote = {
      ...cur,
      title: title || "Untitled",
      body: noteBody,
      updatedAt: new Date().toISOString(),
    };
    data.items[idx] = item;
    await persistPayload(data);
    return res.json({ item });
  } catch (e) {
    if (e instanceof Error && e.message === "payload too large") {
      return res.status(400).json({ error: "notes storage full" });
    }
    return res.status(500).json({ error: "failed to update note" });
  }
});

router.delete("/:id", notesLimiter, async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id.slice(0, 64) : "";
  if (!id) return res.status(400).json({ error: "invalid id" });
  try {
    const data = await loadAndMigrate();
    const next = data.items.filter((x) => x.id !== id);
    if (next.length === data.items.length) return res.status(404).json({ error: "not found" });
    data.items = next;
    await persistPayload(data);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "failed to delete note" });
  }
});

export default router;
