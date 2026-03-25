import path from "path";

function getRepoRootDir(): string {
  // This file lives in `backend/src/utils/` during development and
  // `backend/dist/utils/` after compilation.
  // In both cases, walking up 3 directories yields the repo root:
  // - backend/src/utils -> backend/src -> backend -> repo root
  // - backend/dist/utils -> backend/dist -> backend -> repo root
  return path.resolve(__dirname, "..", "..", "..");
}

export function getDataDir(): string {
  const raw = process.env.DATA_DIR?.trim();
  const repoRoot = getRepoRootDir();

  if (raw) {
    // If set to a relative path, interpret it relative to repo root
    // (so `process.cwd()` can't accidentally change the location).
    return path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
  }

  return path.join(repoRoot, "data");
}

export function getAuthDbPath(): string {
  return path.join(getDataDir(), "auth.db");
}

export function getUploadsRoot(): string {
  return path.join(getDataDir(), "uploads");
}

