/** DB row shape for `SELECT * FROM projects` after GitHub migration */
export type ProjectRow = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  body: string | null;
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
};

export type ApiProject = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  githubRepoId: number | null;
  source: "manual" | "github";
  repoFullName: string | null;
  repoHtmlUrl: string | null;
  repoHomepage: string | null;
  repoPushedAt: string | null;
  repoLanguage: string | null;
  syncHidden: boolean;
};

export function projectRowToApi(
  row: ProjectRow,
  tags: string[],
  opts?: { list?: boolean },
): ApiProject {
  const source: "manual" | "github" =
    row.source === "github" ? "github" : "manual";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    status: row.status,
    body: opts?.list ? null : row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
    githubRepoId: row.github_repo_id ?? null,
    source,
    repoFullName: row.repo_full_name ?? null,
    repoHtmlUrl: row.repo_html_url ?? null,
    repoHomepage: row.repo_homepage ?? null,
    repoPushedAt: row.repo_pushed_at ?? null,
    repoLanguage: row.repo_language ?? null,
    syncHidden: Boolean(row.sync_hidden),
  };
}
