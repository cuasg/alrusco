import { Router } from "express";
import { getDb } from "../auth/userStore";
import { requireAuth } from "../auth/authMiddleware";
import { sanitizeTextForDisplay } from "../utils/sanitize";
import { ensureUniqueSlug, slugifyTitle } from "../utils/projectSlug";
import { projectRowToApi, type ProjectRow } from "../utils/projectJson";

const router = Router();

router.use(requireAuth);

type ProjectInput = {
  slug?: string;
  title?: string;
  summary?: string;
  category?: string;
  status?: string;
  body?: string | null;
  tags?: string[];
  syncHidden?: boolean;
};

const MAX_PROJECT_BODY_LENGTH = 10_000;
const MAX_PROJECT_TAG_LENGTH = 50;
const MAX_PROJECT_TAGS = 20;

const ALLOWED_CATEGORIES = ["infra", "apps", "oss"];
const ALLOWED_STATUSES = ["active", "archived", "draft", "planning"];

function validateProjectPayload(payload: ProjectInput, isUpdate: boolean) {
  const errors: string[] = [];

  const requiredFields: (keyof ProjectInput)[] = [
    "title",
    "summary",
    "category",
    "status",
  ];

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
  if (payload.summary && payload.summary.length > 500) {
    errors.push("summary too long (max 500 chars)");
  }
  if (payload.category !== undefined && payload.category !== null) {
    const cat = typeof payload.category === "string" ? payload.category.trim().toLowerCase() : "";
    if (cat && !ALLOWED_CATEGORIES.includes(cat)) {
      errors.push(`category must be one of: ${ALLOWED_CATEGORIES.join(", ")}`);
    }
    if (payload.category && payload.category.length > 100) {
      errors.push("category too long (max 100 chars)");
    }
  }
  if (payload.status !== undefined && payload.status !== null) {
    const st = typeof payload.status === "string" ? payload.status.trim().toLowerCase() : "";
    if (st && !ALLOWED_STATUSES.includes(st)) {
      errors.push(`status must be one of: ${ALLOWED_STATUSES.join(", ")}`);
    }
    if (payload.status && payload.status.length > 100) {
      errors.push("status too long (max 100 chars)");
    }
  }

  if (payload.body !== undefined && payload.body !== null) {
    if (typeof payload.body !== "string") {
      errors.push("body must be a string or null");
    } else if (payload.body.length > MAX_PROJECT_BODY_LENGTH) {
      errors.push(`body too long (max ${MAX_PROJECT_BODY_LENGTH} chars)`);
    }
  }

  if (payload.tags !== undefined) {
    if (!Array.isArray(payload.tags)) {
      errors.push("tags must be an array of strings");
    } else {
      if (payload.tags.length > MAX_PROJECT_TAGS) {
        errors.push(`too many tags (max ${MAX_PROJECT_TAGS})`);
      }
      for (const tag of payload.tags) {
        if (typeof tag !== "string") {
          errors.push("tags must be strings");
          break;
        }
        if (tag.length > MAX_PROJECT_TAG_LENGTH) {
          errors.push(
            `tag "${tag.slice(0, MAX_PROJECT_TAG_LENGTH)}…" too long (max ${MAX_PROJECT_TAG_LENGTH} chars)`,
          );
          break;
        }
      }
    }
  }

  if (payload.syncHidden !== undefined && payload.syncHidden !== null) {
    if (typeof payload.syncHidden !== "boolean") {
      errors.push("syncHidden must be a boolean");
    }
  }

  return errors;
}

router.post("/", async (req, res) => {
  const payload = req.body as ProjectInput;
  const errors = validateProjectPayload(payload, false);

  if (errors.length) {
    return res.status(400).json({ error: errors.join(", ") });
  }

  try {
    const db = await getDb();
    const now = new Date().toISOString();

    const baseSlug =
      (payload.slug && payload.slug.trim()) ||
      (payload.title ? slugifyTitle(payload.title) : "project");
    const slug = await ensureUniqueSlug(baseSlug);

    await db.exec("BEGIN");

    const bodySafe =
      payload.body != null && payload.body !== ""
        ? sanitizeTextForDisplay(payload.body)
        : null;

    const result = await db.run(
      `
        INSERT INTO projects (slug, title, summary, category, status, body, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      slug,
      payload.title!.trim(),
      payload.summary!.trim(),
      payload.category!.trim().toLowerCase(),
      payload.status!.trim().toLowerCase(),
      bodySafe,
      now,
      now,
    );

    const projectId = result.lastID as number;

    const tags = Array.isArray(payload.tags)
      ? payload.tags
          .map((t) => (typeof t === "string" ? t.trim() : ""))
          .filter(Boolean)
      : [];

    for (const tag of tags) {
      // eslint-disable-next-line no-await-in-loop
      await db.run(
        "INSERT INTO project_tags (project_id, tag) VALUES (?, ?)",
        projectId,
        tag,
      );
    }

    await db.exec("COMMIT");

    return res.status(201).json({
      project: {
        id: projectId,
        slug,
        title: payload.title,
        summary: payload.summary,
        category: payload.category,
        status: payload.status,
        body: payload.body ?? null,
        createdAt: now,
        updatedAt: now,
        tags,
      },
    });
  } catch (err) {
    try {
      const db = await getDb();
      await db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    return res.status(500).json({ error: "failed to create project" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const payload = req.body as ProjectInput;

  const errors = validateProjectPayload(payload, true);
  if (errors.length) {
    return res.status(400).json({ error: errors.join(", ") });
  }

  const projectId = Number(id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({ error: "invalid id" });
  }

  try {
    const db = await getDb();

    const existing = await db.get<{ id: number; slug: string } | undefined>(
      "SELECT id, slug FROM projects WHERE id = ?",
      projectId,
    );

    if (!existing) {
      return res.status(404).json({ error: "project not found" });
    }

    await db.exec("BEGIN");

    const fields: string[] = [];
    const params: unknown[] = [];

    let slug = existing.slug;

    if (payload.slug && payload.slug.trim()) {
      slug = await ensureUniqueSlug(payload.slug.trim());
      fields.push("slug = ?");
      params.push(slug);
    } else if (payload.title && payload.title.trim()) {
      const newBaseSlug = slugifyTitle(payload.title);
      if (newBaseSlug && newBaseSlug !== existing.slug) {
        slug = await ensureUniqueSlug(newBaseSlug);
        fields.push("slug = ?");
        params.push(slug);
      }
    }

    if (payload.title && payload.title.trim()) {
      fields.push("title = ?");
      params.push(payload.title.trim());
    }
    if (payload.summary && payload.summary.trim()) {
      fields.push("summary = ?");
      params.push(payload.summary.trim());
    }
    if (payload.category && payload.category.trim()) {
      fields.push("category = ?");
      params.push(payload.category.trim().toLowerCase());
    }
    if (payload.status && payload.status.trim()) {
      fields.push("status = ?");
      params.push(payload.status.trim().toLowerCase());
    }
    if (payload.body !== undefined) {
      const bodySafe =
        payload.body != null && payload.body !== ""
          ? sanitizeTextForDisplay(payload.body)
          : null;
      fields.push("body = ?");
      params.push(bodySafe);
    }

    if (payload.syncHidden !== undefined) {
      fields.push("sync_hidden = ?");
      params.push(payload.syncHidden ? 1 : 0);
    }

    const now = new Date().toISOString();
    fields.push("updated_at = ?");
    params.push(now);

    if (fields.length) {
      params.push(projectId);
      await db.run(
        `UPDATE projects SET ${fields.join(", ")} WHERE id = ?`,
        ...params,
      );
    }

    if (payload.tags) {
      await db.run("DELETE FROM project_tags WHERE project_id = ?", projectId);

      const tags = Array.isArray(payload.tags)
        ? payload.tags
            .map((t) => (typeof t === "string" ? t.trim() : ""))
            .filter(Boolean)
        : [];

      for (const tag of tags) {
        // eslint-disable-next-line no-await-in-loop
        await db.run(
          "INSERT INTO project_tags (project_id, tag) VALUES (?, ?)",
          projectId,
          tag,
        );
      }
    }

    await db.exec("COMMIT");

    const updated = await db.get<ProjectRow | undefined>(
      "SELECT * FROM projects WHERE id = ?",
      projectId,
    );

    if (!updated) {
      return res.status(404).json({ error: "project not found" });
    }

    const tagsRows = await db.all<{ tag: string }[]>(
      "SELECT tag FROM project_tags WHERE project_id = ?",
      projectId,
    );

    return res.json({
      project: projectRowToApi(updated, tagsRows.map((t) => t.tag)),
    });
  } catch (err) {
    try {
      const db = await getDb();
      await db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    return res.status(500).json({ error: "failed to update project" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const projectId = Number(id);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({ error: "invalid id" });
  }

  try {
    const db = await getDb();
    const result = await db.run("DELETE FROM projects WHERE id = ?", projectId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "project not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to delete project" });
  }
});

export default router;

