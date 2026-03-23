import { getDb } from "../auth/userStore";
import { ensureUniqueSlug, slugifyTitle } from "../utils/projectSlug";
import { getResolvedGithubCredentials } from "./githubCredentials";

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  homepage: string | null;
  pushed_at: string | null;
  language: string | null;
  topics?: string[];
};

const DEFAULT_UA =
  process.env.GITHUB_API_USER_AGENT || "AlruscoPortfolio/1.0 (github sync)";

function excludeForks(): boolean {
  return process.env.GITHUB_SYNC_EXCLUDE_FORKS !== "false";
}

function excludeArchived(): boolean {
  return process.env.GITHUB_SYNC_EXCLUDE_ARCHIVED !== "false";
}

function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

async function githubFetch(url: string, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": DEFAULT_UA,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url, { headers });
}

async function fetchAllRepos(
  baseListUrl: string,
  token: string | null,
): Promise<GithubRepo[]> {
  const all: GithubRepo[] = [];
  let next: string | null = baseListUrl;
  let guard = 0;

  while (next && guard < 30) {
    guard += 1;
    const res = await githubFetch(next, token);
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw new Error("GitHub API returned non-JSON");
    }
    if (!res.ok) {
      const msg =
        typeof data === "object" && data && "message" in data
          ? String((data as { message: string }).message)
          : res.statusText;
      throw new Error(`GitHub API error (${res.status}): ${msg}`);
    }
    if (!Array.isArray(data)) {
      throw new Error("GitHub API returned unexpected payload");
    }
    all.push(...(data as GithubRepo[]));
    next = parseLinkNext(res.headers.get("link"));
  }

  return all;
}

export type SyncGithubResult = {
  created: number;
  updated: number;
  skipped: number;
  totalRemote: number;
};

export async function syncGithubProjects(): Promise<SyncGithubResult> {
  const { owner, ownerKind, token } = await getResolvedGithubCredentials();

  if (!owner) {
    throw new Error(
      "GitHub owner not configured. Set owner in Settings or GITHUB_USERNAME / GITHUB_ORG in the environment.",
    );
  }

  const perPage = 100;
  const baseUrl =
    ownerKind === "org"
      ? `https://api.github.com/orgs/${encodeURIComponent(owner)}/repos?per_page=${perPage}&sort=pushed`
      : `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=${perPage}&sort=pushed`;

  const repos = await fetchAllRepos(baseUrl, token);

  const filtered = repos.filter((r) => {
    if (excludeForks() && r.fork) return false;
    if (excludeArchived() && r.archived) return false;
    return true;
  });

  const db = await getDb();
  let created = 0;
  let updated = 0;
  const now = new Date().toISOString();

  await db.exec("BEGIN");

  try {
    for (const repo of filtered) {
      const topicsJson =
        repo.topics && repo.topics.length
          ? JSON.stringify(repo.topics)
          : null;

      const existing = await db.get<{ id: number } | undefined>(
        "SELECT id FROM projects WHERE github_repo_id = ?",
        repo.id,
      );

      if (existing) {
        await db.run(
          `
          UPDATE projects SET
            repo_full_name = ?,
            repo_html_url = ?,
            repo_homepage = ?,
            repo_pushed_at = ?,
            repo_language = ?,
            repo_topics_json = ?,
            source = 'github',
            updated_at = ?
          WHERE id = ?
        `,
          repo.full_name,
          repo.html_url,
          repo.homepage?.trim() || null,
          repo.pushed_at,
          repo.language,
          topicsJson,
          now,
          existing.id,
        );
        updated += 1;
      } else {
        const baseSlug = slugifyTitle(repo.name) || "repo";
        const slug = await ensureUniqueSlug(baseSlug);
        const summary =
          (repo.description && repo.description.trim()) ||
          "Imported from GitHub.";
        const status = repo.archived ? "archived" : "active";

        const result = await db.run(
          `
          INSERT INTO projects (
            slug, title, summary, category, status, body,
            github_repo_id, repo_full_name, repo_html_url, repo_homepage,
            repo_pushed_at, repo_language, repo_topics_json,
            sync_hidden, source, created_at, updated_at
          ) VALUES (?, ?, ?, 'oss', ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, 'github', ?, ?)
        `,
          slug,
          repo.name,
          summary,
          status,
          repo.id,
          repo.full_name,
          repo.html_url,
          repo.homepage?.trim() || null,
          repo.pushed_at,
          repo.language,
          topicsJson,
          now,
          now,
        );

        const projectId = result.lastID as number;

        if (repo.topics && repo.topics.length) {
          for (const tag of repo.topics.slice(0, 20)) {
            const t = tag.trim().toLowerCase();
            if (!t) continue;
            // eslint-disable-next-line no-await-in-loop
            await db.run(
              "INSERT INTO project_tags (project_id, tag) VALUES (?, ?)",
              projectId,
              t.slice(0, 50),
            );
          }
        }

        created += 1;
      }
    }

    await db.run(
      `INSERT INTO settings (key, value) VALUES ('github_last_sync_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      now,
    );

    await db.exec("COMMIT");
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }

  const skippedByRules = repos.length - filtered.length;

  return {
    created,
    updated,
    skipped: skippedByRules,
    totalRemote: repos.length,
  };
}
