import { getDb } from "../auth/userStore";

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  const db = await getDb();
  let slug = baseSlug || "project";
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db.get<{ id: number } | undefined>(
      "SELECT id FROM projects WHERE slug = ?",
      slug,
    );
    if (!existing) {
      return slug;
    }
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}
