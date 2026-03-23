import { Router } from "express";
import { getDb } from "../auth/userStore";
import { requireAuth } from "../auth/authMiddleware";
import { sanitizeTextForDisplay } from "../utils/sanitize";

const router = Router();

router.use(requireAuth);

type AlbumInput = {
  name?: string;
  description?: string | null;
};

const MAX_ALBUM_DESCRIPTION_LENGTH = 1_000;

function validateAlbumPayload(payload: AlbumInput, isUpdate: boolean) {
  const errors: string[] = [];

  if (!isUpdate) {
    if (!payload.name || !payload.name.trim()) {
      errors.push("name is required");
    }
  }

  if (payload.name && payload.name.length > 200) {
    errors.push("name too long (max 200 chars)");
  }
  if (payload.description && payload.description.length > MAX_ALBUM_DESCRIPTION_LENGTH) {
    errors.push(`description too long (max ${MAX_ALBUM_DESCRIPTION_LENGTH} chars)`);
  }

  return errors;
}

router.post("/", async (req, res) => {
  const payload = req.body as AlbumInput;
  const errors = validateAlbumPayload(payload, false);

  if (errors.length) {
    return res.status(400).json({ error: errors.join(", ") });
  }

  try {
    const db = await getDb();
    const now = new Date().toISOString();

    const descriptionSafe =
      payload.description != null && payload.description !== ""
        ? sanitizeTextForDisplay(payload.description)
        : null;

    const result = await db.run(
      `
        INSERT INTO albums (name, description, created_at)
        VALUES (?, ?, ?)
      `,
      payload.name!.trim(),
      descriptionSafe,
      now,
    );

    const albumId = result.lastID as number;

    return res.status(201).json({
      album: {
        id: albumId,
        name: payload.name,
        description: payload.description ?? null,
        createdAt: now,
      },
    });
  } catch (err: any) {
    if (err && err.code === "SQLITE_CONSTRAINT") {
      return res.status(409).json({ error: "album name must be unique" });
    }
    return res.status(500).json({ error: "failed to create album" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const payload = req.body as AlbumInput;

  const errors = validateAlbumPayload(payload, true);
  if (errors.length) {
    return res.status(400).json({ error: errors.join(", ") });
  }

  const albumId = Number(id);
  if (!Number.isInteger(albumId) || albumId <= 0) {
    return res.status(400).json({ error: "invalid id" });
  }

  try {
    const db = await getDb();

    const existing = await db.get<{ id: number } | undefined>(
      "SELECT id FROM albums WHERE id = ?",
      albumId,
    );
    if (!existing) {
      return res.status(404).json({ error: "album not found" });
    }

    const fields: string[] = [];
    const params: unknown[] = [];

    if (payload.name && payload.name.trim()) {
      fields.push("name = ?");
      params.push(payload.name.trim());
    }
    if (payload.description !== undefined) {
      const descriptionSafe =
        payload.description != null && payload.description !== ""
          ? sanitizeTextForDisplay(payload.description)
          : null;
      fields.push("description = ?");
      params.push(descriptionSafe);
    }

    if (fields.length === 0) {
      return res.json({ ok: true });
    }

    params.push(albumId);

    await db.run(
      `UPDATE albums SET ${fields.join(", ")} WHERE id = ?`,
      ...params,
    );

    const updated = await db.get<{
      id: number;
      name: string;
      description: string | null;
      created_at: string;
    } | undefined>("SELECT * FROM albums WHERE id = ?", albumId);

    if (!updated) {
      return res.status(404).json({ error: "album not found" });
    }

    return res.json({
      album: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        createdAt: updated.created_at,
      },
    });
  } catch (err: any) {
    if (err && err.code === "SQLITE_CONSTRAINT") {
      return res.status(409).json({ error: "album name must be unique" });
    }
    return res.status(500).json({ error: "failed to update album" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const albumId = Number(id);

  if (!Number.isInteger(albumId) || albumId <= 0) {
    return res.status(400).json({ error: "invalid id" });
  }

  try {
    const db = await getDb();
    const result = await db.run("DELETE FROM albums WHERE id = ?", albumId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "album not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to delete album" });
  }
});

export default router;

