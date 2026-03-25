import sqlite3 from "sqlite3";
import path from "path";
import { open, Database } from "sqlite";
import { getAuthDbPath } from "../utils/dataDir";

sqlite3.verbose();

export type UserRecord = {
  id: number;
  username: string;
  password_hash: string;
  totp_secret: string | null;
  created_at: string;
  last_login: string | null;
};

let dbPromise: Promise<Database<sqlite3.Database, sqlite3.Statement>> | null =
  null;

export function getDb() {
  if (!dbPromise) {
    const dbPath = getAuthDbPath();
    dbPromise = open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  }
  return dbPromise;
}

export async function initUserStore() {
  const db = await getDb();
  await db.exec(`PRAGMA foreign_keys = ON;`);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      totp_secret TEXT,
      created_at TEXT NOT NULL,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      body TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_tags (
      project_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      url TEXT NOT NULL,
      category TEXT NOT NULL,
      taken_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photo_albums (
      photo_id INTEGER NOT NULL,
      album_id INTEGER NOT NULL,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photo_projects (
      photo_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photo_tags (
      photo_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS collection_covers (
      collection_kind TEXT NOT NULL,
      collection_id INTEGER NOT NULL,
      photo_id INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
      UNIQUE (collection_kind, collection_id, slot)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Lightweight migration: ensure photos table has original_url column for full-resolution paths
  const photoColumns = await db.all<{ name: string }[]>("PRAGMA table_info(photos);");
  const hasOriginalUrl = photoColumns.some((col) => col.name === "original_url");
  if (!hasOriginalUrl) {
    await db.exec(`ALTER TABLE photos ADD COLUMN original_url TEXT;`);
  }

  // GitHub integration columns on projects
  const projectCols = await db.all<{ name: string }[]>("PRAGMA table_info(projects);");
  const hasCol = (n: string) => projectCols.some((c) => c.name === n);

  if (!hasCol("github_repo_id")) {
    await db.exec(`ALTER TABLE projects ADD COLUMN github_repo_id INTEGER;`);
  }
  if (!hasCol("repo_full_name")) {
    await db.exec(`ALTER TABLE projects ADD COLUMN repo_full_name TEXT;`);
  }
  if (!hasCol("repo_html_url")) {
    await db.exec(`ALTER TABLE projects ADD COLUMN repo_html_url TEXT;`);
  }
  if (!hasCol("repo_homepage")) {
    await db.exec(`ALTER TABLE projects ADD COLUMN repo_homepage TEXT;`);
  }
  if (!hasCol("repo_pushed_at")) {
    await db.exec(`ALTER TABLE projects ADD COLUMN repo_pushed_at TEXT;`);
  }
  if (!hasCol("repo_language")) {
    await db.exec(`ALTER TABLE projects ADD COLUMN repo_language TEXT;`);
  }
  if (!hasCol("repo_topics_json")) {
    await db.exec(`ALTER TABLE projects ADD COLUMN repo_topics_json TEXT;`);
  }
  if (!hasCol("sync_hidden")) {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN sync_hidden INTEGER NOT NULL DEFAULT 0;`,
    );
  }
  if (!hasCol("source")) {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';`,
    );
  }

  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_github_repo_id
     ON projects(github_repo_id) WHERE github_repo_id IS NOT NULL;`,
  );

  // Ensure an Uncategorised album exists as the fallback "collection" for unassigned photos.
  const uncategorizedName = "Uncategorized";
  const uncategorizedNow = new Date().toISOString();
  await db.run(
    `
      INSERT INTO albums (name, description, created_at)
      SELECT ?, NULL, ?
      WHERE NOT EXISTS (SELECT 1 FROM albums WHERE name = ?)
    `,
    uncategorizedName,
    uncategorizedNow,
    uncategorizedName,
  );

  const uncategorizedAlbum = await db.get<{ id: number }>(
    "SELECT id FROM albums WHERE name = ?",
    uncategorizedName,
  );
  const uncategorizedAlbumId = uncategorizedAlbum?.id;

  // Migrate existing photo assignments so each photo effectively belongs to exactly one collection:
  // - If a photo has any project assignment, delete all album assignments.
  // - Otherwise keep the smallest album_id (if multiple albums exist).
  // - If a photo has neither assignment, assign it to Uncategorized.
  if (uncategorizedAlbumId != null) {
    // Keep at most one project assignment per photo.
    await db.exec(`
      DELETE FROM photo_projects
      WHERE rowid NOT IN (
        SELECT MIN(rowid) FROM photo_projects GROUP BY photo_id
      );
    `);

    // If a photo is assigned to a project, it must not also be in albums.
    await db.exec(`
      DELETE FROM photo_albums
      WHERE photo_id IN (SELECT DISTINCT photo_id FROM photo_projects);
    `);

    // Keep at most one album assignment per photo (for remaining album-only photos).
    await db.exec(`
      DELETE FROM photo_albums
      WHERE rowid NOT IN (
        SELECT MIN(rowid) FROM photo_albums GROUP BY photo_id
      );
    `);

    // Assign any remaining unassigned photos to Uncategorized.
    await db.run(
      `
        INSERT INTO photo_albums (photo_id, album_id)
        SELECT p.id, ?
        FROM photos p
        WHERE p.id NOT IN (SELECT photo_id FROM photo_projects)
          AND p.id NOT IN (SELECT photo_id FROM photo_albums)
      `,
      uncategorizedAlbumId,
    );
  }
}

export async function getUserCount(): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM users",
  );
  return row?.count ?? 0;
}

