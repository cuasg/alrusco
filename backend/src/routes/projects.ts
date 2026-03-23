import { Router } from "express";
import { getDb } from "../auth/userStore";
import { projectRowToApi, type ProjectRow } from "../utils/projectJson";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const { category, status, tag } = req.query as {
      category?: string;
      status?: string;
      tag?: string;
    };

    const params: unknown[] = [];
    const where: string[] = ["(p.sync_hidden IS NULL OR p.sync_hidden = 0)"];

    if (category) {
      where.push("p.category = ?");
      params.push(category);
    }
    if (status) {
      where.push("p.status = ?");
      params.push(status);
    }

    let tagJoin = "";
    if (tag) {
      tagJoin = "INNER JOIN project_tags pt ON pt.project_id = p.id";
      where.push("pt.tag = ?");
      params.push(tag);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const rows = await db.all<
      {
        id: number;
        slug: string;
        title: string;
        summary: string;
        category: string;
        status: string;
        created_at: string;
        updated_at: string;
        github_repo_id: number | null;
        repo_full_name: string | null;
        repo_html_url: string | null;
        repo_homepage: string | null;
        repo_pushed_at: string | null;
        repo_language: string | null;
        repo_topics_json: string | null;
        sync_hidden: number | null;
        source: string | null;
        body: string | null;
        tags: string | null;
      }[]
    >(
      `
      SELECT
        p.id,
        p.slug,
        p.title,
        p.summary,
        p.category,
        p.status,
        p.created_at,
        p.updated_at,
        p.github_repo_id,
        p.repo_full_name,
        p.repo_html_url,
        p.repo_homepage,
        p.repo_pushed_at,
        p.repo_language,
        p.repo_topics_json,
        p.sync_hidden,
        p.source,
        p.body,
        GROUP_CONCAT(DISTINCT t.tag) as tags
      FROM projects p
      LEFT JOIN project_tags t ON t.project_id = p.id
      ${tagJoin}
      ${whereSql}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `,
      params,
    );

    const projects = rows.map((row) => {
      const tags = row.tags ? row.tags.split(",") : [];
      const pr: ProjectRow = {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        category: row.category,
        status: row.status,
        body: row.body,
        created_at: row.created_at,
        updated_at: row.updated_at,
        github_repo_id: row.github_repo_id,
        repo_full_name: row.repo_full_name,
        repo_html_url: row.repo_html_url,
        repo_homepage: row.repo_homepage,
        repo_pushed_at: row.repo_pushed_at,
        repo_language: row.repo_language,
        repo_topics_json: row.repo_topics_json,
        sync_hidden: row.sync_hidden,
        source: row.source,
      };
      return projectRowToApi(pr, tags, { list: true });
    });

    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: "failed to load projects" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;

    const project = await db.get<ProjectRow>(
      "SELECT * FROM projects WHERE id = ?",
      id,
    );

    if (!project) {
      return res.status(404).json({ error: "not found" });
    }

    const tagsRows = await db.all<{ tag: string }[]>(
      "SELECT tag FROM project_tags WHERE project_id = ?",
      id,
    );

    res.json({
      project: projectRowToApi(
        project,
        tagsRows.map((t) => t.tag),
      ),
    });
  } catch (err) {
    res.status(500).json({ error: "failed to load project" });
  }
});

export default router;
