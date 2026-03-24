import path from "path";
import fs from "fs";
import multer from "multer";
import sharp from "sharp";
import { Router } from "express";
import { getDb } from "../auth/userStore";
import { requireAuth } from "../auth/authMiddleware";
import { sanitizeTextForDisplay } from "../utils/sanitize";

const router = Router();

router.use(requireAuth);

type PhotoInput = {
  title?: string;
  description?: string | null;
  url?: string;
  originalUrl?: string | null;
  category?: string;
  takenAt?: string | null;
  tags?: string[];
  // New: single collection assignment
  collectionKind?: "album" | "project";
  albumId?: number | null;
  projectId?: number | null;

  // Legacy: allow old clients to specify multiple albums; server will pick one.
  albumIds?: number[];
};

const MAX_PHOTO_DESCRIPTION_LENGTH = 1_000;
const MAX_PHOTO_TAG_LENGTH = 50;
const MAX_PHOTO_TAGS = 20;
const MAX_PHOTO_URL_LENGTH = 500;
const MAX_TAKEN_AT_LENGTH = 100;

function looksLikeSafeUrl(url: string): boolean {
  return /^(https?:\/\/|\/)/i.test(url);
}

function validatePhotoPayload(payload: PhotoInput, isUpdate: boolean) {
  const errors: string[] = [];

  const requiredFields: (keyof PhotoInput)[] = ["title", "url", "category"];

  if (!isUpdate) {
    for (const field of requiredFields) {
      const value = payload[field];
      if (!value || typeof value !== "string" || !value.trim()) {
        errors.push(`${field} is required`);
      }
    }
  }

  if (payload.title && payload.title.length > 200) {
    errors.push("title too long (max 200 chars)");
  }
  if (payload.description && payload.description.length > MAX_PHOTO_DESCRIPTION_LENGTH) {
    errors.push(`description too long (max ${MAX_PHOTO_DESCRIPTION_LENGTH} chars)`);
  }
  if (payload.category && payload.category.length > 100) {
    errors.push("category too long (max 100 chars)");
  }

  if (payload.url !== undefined) {
    if (typeof payload.url !== "string" || !payload.url.trim()) {
      errors.push("url must be a non-empty string");
    } else {
      if (payload.url.length > MAX_PHOTO_URL_LENGTH) {
        errors.push(`url too long (max ${MAX_PHOTO_URL_LENGTH} chars)`);
      }
      if (!looksLikeSafeUrl(payload.url)) {
        errors.push("url must start with http(s):// or /");
      }
    }
  }

  if (payload.takenAt !== undefined && payload.takenAt !== null) {
    if (typeof payload.takenAt !== "string") {
      errors.push("takenAt must be a string or null");
    } else if (payload.takenAt.length > MAX_TAKEN_AT_LENGTH) {
      errors.push(`takenAt too long (max ${MAX_TAKEN_AT_LENGTH} chars)`);
    }
  }

  if (payload.tags !== undefined) {
    if (!Array.isArray(payload.tags)) {
      errors.push("tags must be an array of strings");
    } else {
      if (payload.tags.length > MAX_PHOTO_TAGS) {
        errors.push(`too many tags (max ${MAX_PHOTO_TAGS})`);
      }
      for (const tag of payload.tags) {
        if (typeof tag !== "string") {
          errors.push("tags must be strings");
          break;
        }
        if (tag.length > MAX_PHOTO_TAG_LENGTH) {
          errors.push(
            `tag "${tag.slice(0, MAX_PHOTO_TAG_LENGTH)}…" too long (max ${MAX_PHOTO_TAG_LENGTH} chars)`,
          );
          break;
        }
      }
    }
  }

  if (payload.albumIds !== undefined) {
    if (!Array.isArray(payload.albumIds)) {
      errors.push("albumIds must be an array of numbers");
    }
  }

  if (payload.collectionKind !== undefined && payload.collectionKind !== null) {
    if (payload.collectionKind !== "album" && payload.collectionKind !== "project") {
      errors.push("collectionKind must be 'album' or 'project'");
    }
  }

  if (payload.albumId !== undefined && payload.albumId !== null) {
    if (!Number.isInteger(payload.albumId) || payload.albumId <= 0) {
      errors.push("albumId must be a positive integer or null");
    }
  }

  if (payload.projectId !== undefined && payload.projectId !== null) {
    if (!Number.isInteger(payload.projectId) || payload.projectId <= 0) {
      errors.push("projectId must be a positive integer or null");
    }
  }

  return errors;
}

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");
const UPLOAD_ORIGINAL_DIR = path.join(UPLOAD_ROOT, "originals");
const UPLOAD_WEB_DIR = path.join(UPLOAD_ROOT, "photos");

for (const dir of [UPLOAD_ROOT, UPLOAD_ORIGINAL_DIR, UPLOAD_WEB_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOAD_ORIGINAL_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      const base = path
        .basename(file.originalname, ext)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      cb(null, `${base || "photo"}-${unique}${ext.toLowerCase()}`);
    },
  }),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
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
      cb(
        new Error(
          "Only JPEG, PNG, WebP, GIF, or HEIC/HEIF uploads are allowed (not SVG)",
        ),
      );
      return;
    }
    cb(null, true);
  },
});

const MAX_BULK_UPLOAD_FILES = 40;

type ParsedUploadForm = {
  title?: string;
  description?: string | null;
  category: string;
  takenAt?: string | null;
  tags: string[] | undefined;
  albumIds: number[] | undefined;
  collectionKind: "album" | "project" | undefined;
  albumId: number | null | undefined;
  projectId: number | null | undefined;
};

function titleFromOriginalFilename(originalname: string): string {
  const ext = path.extname(originalname);
  const base = path
    .basename(originalname, ext)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const t = base.slice(0, 200);
  return t || "Photo";
}

function parsePhotoUploadForm(body: Record<string, string | undefined>): ParsedUploadForm {
  const {
    title,
    description,
    category,
    takenAt,
    tags: tagsJson,
    albumIds: albumIdsJson,
    collectionKind: collectionKindRaw,
    albumId: albumIdRaw,
    projectId: projectIdRaw,
  } = body;

  let tags: string[] | undefined;
  if (tagsJson) {
    try {
      const parsed = JSON.parse(tagsJson) as unknown;
      if (Array.isArray(parsed)) {
        tags = parsed
          .map((t) => (typeof t === "string" ? t.trim() : ""))
          .filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  }

  let albumIds: number[] | undefined;
  if (albumIdsJson) {
    try {
      const parsed = JSON.parse(albumIdsJson) as unknown;
      if (Array.isArray(parsed)) {
        albumIds = parsed
          .map((n) =>
            typeof n === "number" ? n : typeof n === "string" ? Number.parseInt(n, 10) : NaN,
          )
          .filter((n) => Number.isInteger(n) && n > 0);
      }
    } catch {
      /* ignore */
    }
  }

  let albumId: number | null | undefined;
  if (albumIdRaw != null) {
    const trimmed = String(albumIdRaw).trim();
    if (trimmed) {
      const n = Number.parseInt(trimmed, 10);
      albumId = Number.isInteger(n) && n > 0 ? n : null;
    } else {
      albumId = null;
    }
  }

  let projectId: number | null | undefined;
  if (projectIdRaw != null) {
    const trimmed = String(projectIdRaw).trim();
    if (trimmed) {
      const n = Number.parseInt(trimmed, 10);
      projectId = Number.isInteger(n) && n > 0 ? n : null;
    } else {
      projectId = null;
    }
  }

  const collectionKind =
    collectionKindRaw === "project" || projectId != null
      ? "project"
      : collectionKindRaw === "album" || albumId != null
        ? "album"
        : undefined;

  return {
    title,
    description: description?.trim() ? description : null,
    category: (category && category.trim()) || "general",
    takenAt: takenAt?.trim() ? takenAt : null,
    tags,
    albumIds,
    collectionKind: collectionKind as "album" | "project" | undefined,
    albumId,
    projectId,
  };
}

/** Reject non-raster / unexpected content (declared MIME can lie). */
const SHARP_SAFE_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "gif",
  "heif",
  "avif",
  "tiff",
  "jp2",
  "jxl",
]);

async function assertProcessableRasterImage(filePath: string): Promise<void> {
  const meta = await sharp(filePath).metadata();
  if (!meta.format) {
    throw new Error("Could not read image file");
  }
  if (meta.format === "svg" || !SHARP_SAFE_FORMATS.has(meta.format)) {
    throw new Error("Unsupported or unsafe image type");
  }
}

async function writeWebDerivative(file: Express.Multer.File): Promise<{
  webUrl: string;
  originalUrl: string;
}> {
  const webFilename = `${path
    .basename(file.filename, path.extname(file.filename))
    .toLowerCase()}-web.jpg`;
  const webPath = path.join(UPLOAD_WEB_DIR, webFilename);

  try {
    await assertProcessableRasterImage(file.path);

    await sharp(file.path)
      .rotate()
      .resize(1920, 1080, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 82,
        chromaSubsampling: "4:2:0",
      })
      .toFile(webPath);
  } catch (err) {
    await fs.promises.unlink(file.path).catch(() => {});
    await fs.promises.unlink(webPath).catch(() => {});
    throw err;
  }

  return {
    webUrl: `/uploads/photos/${webFilename}`,
    originalUrl: `/uploads/originals/${file.filename}`,
  };
}

async function persistPhotoFromUpload(
  file: Express.Multer.File,
  form: ParsedUploadForm,
  titleOverride?: string,
): Promise<{
  photoId: number;
  createdAt: string;
  savedTags: string[];
  savedAlbumIds: number[];
  webUrl: string;
  originalUrl: string;
  title: string;
  description: string | null;
  category: string;
  takenAt: string | null;
}> {
  const { webUrl, originalUrl } = await writeWebDerivative(file);
  const baseName = titleFromOriginalFilename(file.originalname);
  const title = (titleOverride?.trim() || form.title?.trim() || baseName).slice(0, 200);

  const payload: PhotoInput = {
    title,
    description: form.description ?? null,
    url: webUrl,
    originalUrl,
    category: form.category,
    takenAt: form.takenAt ?? null,
    tags: form.tags,
    albumIds: form.albumIds,
    collectionKind: form.collectionKind,
    albumId: form.albumId,
    projectId: form.projectId,
  };

  const errors = validatePhotoPayload(payload, false);
  if (errors.length) {
    throw new Error(errors.join(", "));
  }

  const { photoId, createdAt, tags: savedTags, albumIds: savedAlbumIds } =
    await createPhotoRecord(payload);

  return {
    photoId,
    createdAt,
    savedTags,
    savedAlbumIds,
    webUrl,
    originalUrl,
    title,
    description: payload.description ?? null,
    category: payload.category!,
    takenAt: payload.takenAt ?? null,
  };
}

async function createPhotoRecord(payload: PhotoInput) {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.exec("BEGIN");

  const descriptionSafe =
    payload.description != null && payload.description !== ""
      ? sanitizeTextForDisplay(payload.description)
      : null;

  const result = await db.run(
    `
        INSERT INTO photos (title, description, url, original_url, category, taken_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    payload.title!.trim(),
    descriptionSafe,
    payload.url!.trim(),
    payload.originalUrl ?? payload.url!.trim(),
    payload.category!.trim(),
    payload.takenAt ?? null,
    now,
  );

  const photoId = result.lastID as number;

  const tags = Array.isArray(payload.tags)
    ? payload.tags
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean)
    : [];

  for (const tag of tags) {
    // eslint-disable-next-line no-await-in-loop
    await db.run(
      "INSERT INTO photo_tags (photo_id, tag) VALUES (?, ?)",
      photoId,
      tag,
    );
  }

  async function getUncategorizedAlbumId() {
    const row = await db.get<{ id: number }>("SELECT id FROM albums WHERE name = ?", "Uncategorized");
    return row?.id;
  }

  const uncategorizedAlbumId = await getUncategorizedAlbumId();
  if (!uncategorizedAlbumId) {
    throw new Error("Uncategorized album not found");
  }

  // Determine final association.
  // Priority:
  // - If a projectId is provided (or collectionKind=project), assign to project.
  // - Otherwise, assign to the chosen album.
  // - If nothing is provided, fall back to Uncategorized.
  const legacyAlbumId =
    Array.isArray(payload.albumIds) && payload.albumIds.length
      ? Math.min(
          ...payload.albumIds.filter(
            (id) => typeof id === "number" && Number.isInteger(id) && id > 0,
          ),
        )
      : null;

  let finalProjectId: number | null = null;
  let assignedAlbumId: number | null = null;

  if (payload.collectionKind === "project" || payload.projectId != null) {
    finalProjectId = payload.projectId ?? null;
  }

  if (finalProjectId != null) {
    await db.run(
      "INSERT INTO photo_projects (photo_id, project_id) VALUES (?, ?)",
      photoId,
      finalProjectId,
    );
  } else {
    assignedAlbumId =
      payload.albumId ?? legacyAlbumId ?? uncategorizedAlbumId;
    await db.run(
      "INSERT INTO photo_albums (photo_id, album_id) VALUES (?, ?)",
      photoId,
      assignedAlbumId,
    );
  }

  await db.exec("COMMIT");

  return {
    photoId,
    createdAt: now,
    tags,
    albumIds: finalProjectId == null ? [assignedAlbumId ?? uncategorizedAlbumId] : [],
    projectId: finalProjectId,
  };
}

router.post("/", async (req, res) => {
  const payload = req.body as PhotoInput;
  const errors = validatePhotoPayload(payload, false);

  if (errors.length) {
    return res.status(400).json({ error: errors.join(", ") });
  }

  try {
    const { photoId, createdAt, tags, albumIds } = await createPhotoRecord(
      payload,
    );

    return res.status(201).json({
      photo: {
        id: photoId,
        title: payload.title,
        description: payload.description ?? null,
        url: payload.url,
        category: payload.category,
        takenAt: payload.takenAt ?? null,
        createdAt,
        tags,
        albumIds,
      },
    });
  } catch (err) {
    try {
      const db = await getDb();
      await db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    return res.status(500).json({ error: "failed to create photo" });
  }
});

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        return res.status(400).json({ error: "file is required" });
      }

      const form = parsePhotoUploadForm(req.body as Record<string, string | undefined>);
      const result = await persistPhotoFromUpload(file, form);

      return res.status(201).json({
        photo: {
          id: result.photoId,
          title: result.title,
          description: result.description,
          url: result.webUrl,
          category: result.category,
          takenAt: result.takenAt,
          createdAt: result.createdAt,
          tags: result.savedTags,
          albumIds: result.savedAlbumIds,
          originalUrl: result.originalUrl,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg &&
        (msg.includes("is required") ||
          msg.includes("must be") ||
          msg.includes("too long") ||
          msg.includes("must start"))
      ) {
        return res.status(400).json({ error: msg });
      }
      // eslint-disable-next-line no-console
      console.error("photo upload failed", err);
      return res.status(500).json({ error: "failed to upload photo" });
    }
  },
);

router.post(
  "/upload-multiple",
  (req, res, next) => {
    upload.array("files", MAX_BULK_UPLOAD_FILES)(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "upload failed";
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        return res.status(400).json({ error: "at least one file is required" });
      }

      const form = parsePhotoUploadForm(req.body as Record<string, string | undefined>);
      const titlePrefix = form.title?.trim();
      const formPerFile: ParsedUploadForm = { ...form, title: undefined };
      const photos: {
        id: number;
        title: string;
        url: string;
        originalUrl: string;
        category: string;
        createdAt: string;
      }[] = [];
      const errors: { filename: string; error: string }[] = [];

      for (const file of files) {
        try {
          const perTitle = titlePrefix
            ? `${titlePrefix}: ${titleFromOriginalFilename(file.originalname)}`.slice(0, 200)
            : undefined;
          const result = await persistPhotoFromUpload(file, formPerFile, perTitle);
          photos.push({
            id: result.photoId,
            title: result.title,
            url: result.webUrl,
            originalUrl: result.originalUrl,
            category: result.category,
            createdAt: result.createdAt,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "failed";
          errors.push({ filename: file.originalname, error: msg });
        }
      }

      if (photos.length === 0) {
        return res.status(400).json({
          error: "no photos could be uploaded",
          errors,
        });
      }

      return res.status(201).json({
        photos,
        errors,
        partial: errors.length > 0,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("bulk photo upload failed", err);
      return res.status(500).json({ error: "failed to upload photos" });
    }
  },
);

type CollectionCoversPayload = {
  collectionKind?: string;
  collectionId?: number;
  coverPhotoIds?: number[];
};

router.put("/collection-covers", async (req, res) => {
  const payload = req.body as CollectionCoversPayload;

  const collectionKind = payload.collectionKind;
  const collectionId = payload.collectionId;
  const coverPhotoIds = payload.coverPhotoIds;

  if (collectionKind !== "album" && collectionKind !== "project") {
    return res.status(400).json({ error: "collectionKind must be 'album' or 'project'" });
  }
  if (!Number.isInteger(collectionId) || (collectionId ?? 0) <= 0) {
    return res.status(400).json({ error: "collectionId must be a positive integer" });
  }
  if (!Array.isArray(coverPhotoIds)) {
    return res.status(400).json({ error: "coverPhotoIds must be an array" });
  }
  if (coverPhotoIds.length > 4) {
    return res.status(400).json({ error: "coverPhotoIds max length is 4" });
  }

  for (const id of coverPhotoIds) {
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "coverPhotoIds must contain positive integers" });
    }
  }

  const unique = new Set(coverPhotoIds);
  if (unique.size !== coverPhotoIds.length) {
    return res.status(400).json({ error: "coverPhotoIds must not contain duplicates" });
  }

  try {
    const db = await getDb();

    if (coverPhotoIds.length > 0) {
      // Ensure provided cover photos actually belong to the target collection.
      const placeholders = coverPhotoIds.map(() => "?").join(",");
      const params: unknown[] = [];

      let verifySql = "";
      if (collectionKind === "album") {
        verifySql = `
          SELECT pa.photo_id as id
          FROM photo_albums pa
          WHERE pa.album_id = ?
            AND pa.photo_id IN (${placeholders})
        `;
      } else {
        verifySql = `
          SELECT pp.photo_id as id
          FROM photo_projects pp
          WHERE pp.project_id = ?
            AND pp.photo_id IN (${placeholders})
        `;
      }

      params.push(collectionId);
      params.push(...coverPhotoIds);

      const rows = await db.all<{ id: number }[]>(verifySql, ...params);
      const found = new Set(rows.map((r) => r.id));
      for (const photoId of coverPhotoIds) {
        if (!found.has(photoId)) {
          return res.status(400).json({ error: "one or more coverPhotoIds do not belong to this collection" });
        }
      }
    }

    await db.exec("BEGIN");
    await db.run(
      "DELETE FROM collection_covers WHERE collection_kind = ? AND collection_id = ?",
      collectionKind,
      collectionId,
    );

    for (let i = 0; i < coverPhotoIds.length; i += 1) {
      const slot = i + 1;
      await db.run(
        "INSERT INTO collection_covers (collection_kind, collection_id, photo_id, slot) VALUES (?, ?, ?, ?)",
        collectionKind,
        collectionId,
        coverPhotoIds[i],
        slot,
      );
    }
    await db.exec("COMMIT");

    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin/photos] PUT /collection-covers failed", err);
    try {
      const db = await getDb();
      await db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    return res.status(500).json({ error: "failed to update collection covers" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const payload = req.body as PhotoInput;

  const errors = validatePhotoPayload(payload, true);
  if (errors.length) {
    return res.status(400).json({ error: errors.join(", ") });
  }

  const photoId = Number(id);
  if (!Number.isInteger(photoId) || photoId <= 0) {
    return res.status(400).json({ error: "invalid id" });
  }

  try {
    const db = await getDb();

    const existing = await db.get<{ id: number } | undefined>(
      "SELECT id FROM photos WHERE id = ?",
      photoId,
    );

    if (!existing) {
      return res.status(404).json({ error: "photo not found" });
    }

    await db.exec("BEGIN");

    const fields: string[] = [];
    const params: unknown[] = [];

    if (payload.title && payload.title.trim()) {
      fields.push("title = ?");
      params.push(payload.title.trim());
    }
    if (payload.description !== undefined) {
      const descriptionSafe =
        payload.description != null && payload.description !== ""
          ? sanitizeTextForDisplay(payload.description)
          : null;
      fields.push("description = ?");
      params.push(descriptionSafe);
    }
    if (payload.url && payload.url.trim()) {
      fields.push("url = ?");
      params.push(payload.url.trim());
    }
    if (payload.category && payload.category.trim()) {
      fields.push("category = ?");
      params.push(payload.category.trim());
    }
    if (payload.takenAt !== undefined) {
      fields.push("taken_at = ?");
      params.push(payload.takenAt ?? null);
    }

    if (fields.length) {
      params.push(photoId);
      await db.run(
        `UPDATE photos SET ${fields.join(", ")} WHERE id = ?`,
        ...params,
      );
    }

    if (payload.tags) {
      await db.run("DELETE FROM photo_tags WHERE photo_id = ?", photoId);

      const tags = Array.isArray(payload.tags)
        ? payload.tags
            .map((t) => (typeof t === "string" ? t.trim() : ""))
            .filter(Boolean)
        : [];

      for (const tag of tags) {
        // eslint-disable-next-line no-await-in-loop
        await db.run(
          "INSERT INTO photo_tags (photo_id, tag) VALUES (?, ?)",
          photoId,
          tag,
        );
      }
    }

    const shouldUpdateCollection =
      payload.collectionKind !== undefined ||
      payload.albumId !== undefined ||
      payload.projectId !== undefined ||
      payload.albumIds !== undefined;

    if (shouldUpdateCollection) {
      const uncategorizedAlbum = await db.get<{ id: number }>(
        "SELECT id FROM albums WHERE name = ?",
        "Uncategorized",
      );
      if (!uncategorizedAlbum) {
        throw new Error("Uncategorized album not found");
      }

      await db.run("DELETE FROM photo_albums WHERE photo_id = ?", photoId);
      await db.run("DELETE FROM photo_projects WHERE photo_id = ?", photoId);

      if (payload.projectId != null) {
        await db.run(
          "INSERT INTO photo_projects (photo_id, project_id) VALUES (?, ?)",
          photoId,
          payload.projectId,
        );
      } else {
        const legacyAlbumIds =
          Array.isArray(payload.albumIds) && payload.albumIds.length
            ? payload.albumIds.filter(
                (aid) => typeof aid === "number" && Number.isInteger(aid) && aid > 0,
              )
            : [];

        const chosenAlbumId =
          payload.albumId != null
            ? payload.albumId
            : legacyAlbumIds.length > 0
              ? Math.min(...legacyAlbumIds)
              : uncategorizedAlbum.id;

        await db.run(
          "INSERT INTO photo_albums (photo_id, album_id) VALUES (?, ?)",
          photoId,
          chosenAlbumId,
        );
      }
    }

    await db.exec("COMMIT");

    const updated = await db.get<{
      id: number;
      title: string;
      description: string | null;
      url: string;
      category: string;
      taken_at: string | null;
      created_at: string;
    } | undefined>("SELECT * FROM photos WHERE id = ?", photoId);

    if (!updated) {
      return res.status(404).json({ error: "photo not found" });
    }

    const tagsRows = await db.all<{ tag: string }[]>(
      "SELECT tag FROM photo_tags WHERE photo_id = ?",
      photoId,
    );

    const albumRows = await db.all<{ album_id: number }[]>(
      "SELECT album_id FROM photo_albums WHERE photo_id = ?",
      photoId,
    );

    return res.json({
      photo: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        url: updated.url,
        category: updated.category,
        takenAt: updated.taken_at,
        createdAt: updated.created_at,
        tags: tagsRows.map((t) => t.tag),
        albumIds: albumRows.map((a) => a.album_id),
      },
    });
  } catch (err) {
    try {
      const db = await getDb();
      await db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    return res.status(500).json({ error: "failed to update photo" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const photoId = Number(id);

  if (!Number.isInteger(photoId) || photoId <= 0) {
    return res.status(400).json({ error: "invalid id" });
  }

  try {
    const db = await getDb();
    const result = await db.run("DELETE FROM photos WHERE id = ?", photoId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "photo not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to delete photo" });
  }
});

export default router;

