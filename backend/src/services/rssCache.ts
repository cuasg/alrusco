import Parser from "rss-parser";
import { getDb } from "../auth/userStore";
import { getRuntimeIntegrationsResolved } from "./runtimeIntegrations";

export type RssFeedDef = {
  id: string;
  url: string;
  title?: string;
  tags?: string[];
  enabled?: boolean;
};

export type RssItem = {
  id: string;
  title: string;
  link: string;
  publishedAt?: string;
  summary?: string;
  imageUrl?: string;
  feedId: string;
  feedTitle?: string;
  tags: string[];
};

const RSS_FEEDS_SETTINGS_KEY = "rss.feeds";

const MAX_FEEDS = 50;
const MAX_ITEMS_PER_FEED = 50;
const MAX_TOTAL_ITEMS = 200;

const parser = new Parser({
  timeout: 10_000,
  // rss-parser in Node 20 can use global fetch; keep default.
});

function toIsoOrUndefined(d: unknown): string | undefined {
  if (typeof d !== "string") return undefined;
  const t = d.trim();
  if (!t) return undefined;
  const dt = new Date(t);
  return Number.isFinite(dt.valueOf()) ? dt.toISOString() : undefined;
}

export async function getRssFeeds(): Promise<RssFeedDef[]> {
  const db = await getDb();
  const row = await db.get<{ value: string } | undefined>(
    "SELECT value FROM settings WHERE key = ?",
    RSS_FEEDS_SETTINGS_KEY,
  );
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RssFeedDef[] = [];
    for (const f of parsed.slice(0, MAX_FEEDS)) {
      const id = typeof (f as any)?.id === "string" ? (f as any).id.trim() : "";
      const url = typeof (f as any)?.url === "string" ? (f as any).url.trim() : "";
      const title = typeof (f as any)?.title === "string" ? (f as any).title.trim() : undefined;
      const tags = Array.isArray((f as any)?.tags)
        ? (f as any).tags
            .filter((t: any) => typeof t === "string")
            .map((t: string) => t.trim())
            .filter(Boolean)
            .slice(0, 8)
        : [];
      const enabled = (f as any)?.enabled === false ? false : true;
      if (!id || id.length > 64 || !url || url.length > 2000) continue;
      out.push({ id, url, ...(title ? { title } : {}), ...(tags.length ? { tags } : {}), enabled });
    }
    return out;
  } catch {
    return [];
  }
}

export async function saveRssFeeds(feeds: RssFeedDef[]): Promise<void> {
  const safe = feeds.slice(0, MAX_FEEDS).map((f) => ({
    id: f.id.trim().slice(0, 64),
    url: f.url.trim().slice(0, 2000),
    title: f.title?.trim().slice(0, 120),
    tags: (f.tags ?? []).slice(0, 8).map((t) => t.trim().slice(0, 32)).filter(Boolean),
    enabled: f.enabled !== false,
  }));

  const db = await getDb();
  await db.run(
    `
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    RSS_FEEDS_SETTINGS_KEY,
    JSON.stringify(safe),
  );
}

async function readCache(url: string): Promise<{
  fetchedAt: string;
  etag: string | null;
  lastModified: string | null;
  payloadJson: string;
} | null> {
  const db = await getDb();
  const row = await db.get<{
    fetched_at: string;
    etag: string | null;
    last_modified: string | null;
    payload_json: string;
  }>("SELECT fetched_at, etag, last_modified, payload_json FROM rss_cache WHERE url = ?", url);
  if (!row) return null;
  return {
    fetchedAt: row.fetched_at,
    etag: row.etag,
    lastModified: row.last_modified,
    payloadJson: row.payload_json,
  };
}

async function writeCache(args: {
  url: string;
  fetchedAt: string;
  etag: string | null;
  lastModified: string | null;
  payloadJson: string;
}): Promise<void> {
  const db = await getDb();
  await db.run(
    `
      INSERT INTO rss_cache (url, fetched_at, etag, last_modified, payload_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        etag = excluded.etag,
        last_modified = excluded.last_modified,
        payload_json = excluded.payload_json
    `,
    args.url,
    args.fetchedAt,
    args.etag,
    args.lastModified,
    args.payloadJson,
  );
}

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function extractFirstImageUrl(raw: any): string | undefined {
  const candidates: string[] = [];
  const enclosureUrl = typeof raw?.enclosure?.url === "string" ? raw.enclosure.url : "";
  if (enclosureUrl) candidates.push(enclosureUrl);

  const mediaContentUrl =
    typeof raw?.["media:content"]?.url === "string"
      ? raw["media:content"].url
      : typeof raw?.mediaContent?.url === "string"
        ? raw.mediaContent.url
        : "";
  if (mediaContentUrl) candidates.push(mediaContentUrl);

  const html =
    typeof raw?.content === "string"
      ? raw.content
      : typeof raw?.contentSnippet === "string"
        ? raw.contentSnippet
        : "";
  if (html) {
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m?.[1]) candidates.push(m[1]);
  }

  for (const c of candidates) {
    const u = c.trim();
    if (u && isHttpUrl(u)) return u.slice(0, 2000);
  }
  return undefined;
}

export async function getAggregatedRssItems(): Promise<RssItem[]> {
  const runtime = await getRuntimeIntegrationsResolved();
  const feeds = (await getRssFeeds()).filter((f) => f.enabled !== false);
  if (!feeds.length) return [];

  const items: RssItem[] = [];

  for (const feed of feeds) {
    if (!isHttpUrl(feed.url)) continue;

    const cached = await readCache(feed.url);
    const now = Date.now();
    const cachedAt = cached ? new Date(cached.fetchedAt).valueOf() : 0;
    const stale =
      !cached || !Number.isFinite(cachedAt) || now - cachedAt > runtime.rssMinRefreshMs;

    if (stale) {
      try {
        const httpRes = await fetch(feed.url, {
          headers: {
            "User-Agent": "alrusco/1.0 (rss)",
            ...(cached?.etag ? { "If-None-Match": cached.etag } : {}),
            ...(cached?.lastModified ? { "If-Modified-Since": cached.lastModified } : {}),
          },
        });

        if (httpRes.status === 304 && cached) {
          await writeCache({
            url: feed.url,
            fetchedAt: new Date().toISOString(),
            etag: cached.etag,
            lastModified: cached.lastModified,
            payloadJson: cached.payloadJson,
          });
        } else if (httpRes.ok) {
          const text = await httpRes.text();
          const parsed = await parser.parseString(text);
          const payloadJson = JSON.stringify(parsed);
          await writeCache({
            url: feed.url,
            fetchedAt: new Date().toISOString(),
            etag: httpRes.headers.get("etag"),
            lastModified: httpRes.headers.get("last-modified"),
            payloadJson,
          });
        }
      } catch {
        // Keep old cache on failure.
      }
    }

    const effective = await readCache(feed.url);
    if (!effective) continue;

    try {
      const parsed = JSON.parse(effective.payloadJson) as any;
      const feedTitle = typeof parsed?.title === "string" ? parsed.title : feed.title;
      const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];

      for (const it of rawItems.slice(0, MAX_ITEMS_PER_FEED)) {
        const title = typeof it?.title === "string" ? it.title.trim() : "";
        const link = typeof it?.link === "string" ? it.link.trim() : "";
        if (!title || !link) continue;
        const guid =
          typeof it?.guid === "string" && it.guid.trim()
            ? it.guid.trim()
            : `${feed.id}:${link}`;
        const summary =
          typeof it?.contentSnippet === "string"
            ? it.contentSnippet.trim().slice(0, 900)
            : typeof it?.content === "string"
              ? it.content.trim().slice(0, 900)
              : undefined;
        const imageUrl = extractFirstImageUrl(it);

        items.push({
          id: guid.slice(0, 300),
          title: title.slice(0, 200),
          link: link.slice(0, 2000),
          publishedAt: toIsoOrUndefined(it?.isoDate ?? it?.pubDate),
          summary,
          ...(imageUrl ? { imageUrl } : {}),
          feedId: feed.id,
          feedTitle: feedTitle?.toString?.()?.slice?.(0, 120),
          tags: (feed.tags ?? []).slice(0, 8),
        });
      }
    } catch {
      continue;
    }
  }

  items.sort((a, b) => {
    const at = a.publishedAt ? new Date(a.publishedAt).valueOf() : 0;
    const bt = b.publishedAt ? new Date(b.publishedAt).valueOf() : 0;
    return bt - at;
  });

  return items.slice(0, MAX_TOTAL_ITEMS);
}

