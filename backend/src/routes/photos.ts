import { Router } from "express";
import { getDb } from "../auth/userStore";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const { album, category, tag, sort } = req.query as {
      album?: string;
      category?: string;
      tag?: string;
      sort?: string;
    };

    const params: unknown[] = [];
    const where: string[] = [];
    let joinAlbum = "";
    let joinTag = "";

    if (category) {
      where.push("p.category = ?");
      params.push(category);
    }

    if (album) {
      joinAlbum =
        "INNER JOIN photo_albums pa ON pa.photo_id = p.id INNER JOIN albums a ON a.id = pa.album_id";
      where.push("a.name = ?");
      params.push(album);
    }

    if (tag) {
      joinTag = "INNER JOIN photo_tags pt ON pt.photo_id = p.id";
      where.push("pt.tag = ?");
      params.push(tag);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const orderBy =
      sort === "oldest"
        ? "ORDER BY COALESCE(p.taken_at, p.created_at) ASC"
        : "ORDER BY COALESCE(p.taken_at, p.created_at) DESC";

    // Basic debug logging for troubleshooting
    // eslint-disable-next-line no-console
    console.log("[photos] GET /api/photos", {
      album,
      category,
      tag,
      sort,
      whereSql,
      orderBy,
    });

    const rows = await db.all<
      {
        id: number;
        title: string;
        description: string | null;
        url: string;
        category: string;
        taken_at: string | null;
        created_at: string;
        tags: string | null;
        albums: string | null;
      }[]
    >(
      `
      SELECT
        p.id,
        p.title,
        p.description,
        p.url,
        p.category,
        p.taken_at,
        p.created_at,
        GROUP_CONCAT(DISTINCT t.tag) as tags,
        GROUP_CONCAT(DISTINCT a.name) as albums
      FROM photos p
      LEFT JOIN photo_tags t ON t.photo_id = p.id
      LEFT JOIN photo_albums pa2 ON pa2.photo_id = p.id
      LEFT JOIN albums a ON a.id = pa2.album_id
      ${joinAlbum}
      ${joinTag}
      ${whereSql}
      GROUP BY p.id
      ${orderBy}
    `,
      params,
    );

    const photos = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      url: row.url,
      originalUrl: undefined,
      category: row.category,
      takenAt: row.taken_at,
      createdAt: row.created_at,
      tags: row.tags ? row.tags.split(",") : [],
      albums: row.albums ? row.albums.split(",") : [],
    }));

    res.json({ photos });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[photos] GET /api/photos failed", err);
    res.status(500).json({ error: "failed to load photos" });
  }
});

type CollagePhoto = {
  id: number;
  url: string;
  title: string;
};

type CollectionTile =
  | {
      kind: "album";
      id: number;
      title: string;
      photoCount: number;
      collagePhotos: CollagePhoto[];
      coverEditable: boolean;
    }
  | {
      kind: "project";
      id: number;
      title: string;
      photoCount: number;
      collagePhotos: CollagePhoto[];
      coverEditable: boolean;
    };

router.get("/collections", async (_req, res) => {
  try {
    const db = await getDb();

    async function getAlbumCollage(albumId: number): Promise<{
      collagePhotos: CollagePhoto[];
      photoCount: number;
    }> {
      const overrides = await db.all<
        {
          slot: number;
          photo_id: number;
          url: string;
          title: string;
        }[]
      >(
        `
        SELECT
          cc.slot,
          cc.photo_id,
          p.url,
          p.title
        FROM collection_covers cc
        INNER JOIN photos p ON p.id = cc.photo_id
        WHERE cc.collection_kind = 'album'
          AND cc.collection_id = ?
        ORDER BY cc.slot ASC
      `,
        albumId,
      );

      if (overrides.length > 0) {
        return {
          collagePhotos: overrides.map((o) => ({
            id: o.photo_id,
            url: o.url,
            title: o.title,
          })),
          photoCount: overrides.length,
        };
      }

      const photosTop = await db.all<{ id: number; url: string; title: string }[]>(
        `
        SELECT
          p.id,
          p.url,
          p.title
        FROM photo_albums pa
        INNER JOIN photos p ON p.id = pa.photo_id
        WHERE pa.album_id = ?
        ORDER BY COALESCE(p.taken_at, p.created_at) DESC
        LIMIT 4
      `,
        albumId,
      );

      const countRow = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM photo_albums WHERE album_id = ?`,
        albumId,
      );

      return {
        collagePhotos: photosTop.map((p) => ({ id: p.id, url: p.url, title: p.title })),
        photoCount: countRow?.count ?? 0,
      };
    }

    async function getProjectCollage(projectId: number): Promise<{
      collagePhotos: CollagePhoto[];
      photoCount: number;
    }> {
      const overrides = await db.all<
        {
          slot: number;
          photo_id: number;
          url: string;
          title: string;
        }[]
      >(
        `
        SELECT
          cc.slot,
          cc.photo_id,
          p.url,
          p.title
        FROM collection_covers cc
        INNER JOIN photos p ON p.id = cc.photo_id
        WHERE cc.collection_kind = 'project'
          AND cc.collection_id = ?
        ORDER BY cc.slot ASC
      `,
        projectId,
      );

      if (overrides.length > 0) {
        return {
          collagePhotos: overrides.map((o) => ({
            id: o.photo_id,
            url: o.url,
            title: o.title,
          })),
          photoCount: overrides.length,
        };
      }

      const photosTop = await db.all<{ id: number; url: string; title: string }[]>(
        `
        SELECT
          p.id,
          p.url,
          p.title
        FROM photo_projects pp
        INNER JOIN photos p ON p.id = pp.photo_id
        WHERE pp.project_id = ?
        ORDER BY COALESCE(p.taken_at, p.created_at) DESC
        LIMIT 4
      `,
        projectId,
      );

      const countRow = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM photo_projects WHERE project_id = ?`,
        projectId,
      );

      return {
        collagePhotos: photosTop.map((p) => ({ id: p.id, url: p.url, title: p.title })),
        photoCount: countRow?.count ?? 0,
      };
    }

    const albums = await db.all<
      { id: number; name: string; photo_count: number }[]
    >(
      `
      SELECT
        a.id,
        a.name,
        COUNT(pa.photo_id) as photo_count
      FROM albums a
      INNER JOIN photo_albums pa ON pa.album_id = a.id
      GROUP BY a.id
      HAVING COUNT(pa.photo_id) > 0
      ORDER BY a.name ASC
    `,
    );

    const projects = await db.all<
      { id: number; title: string; photo_count: number }[]
    >(
      `
      SELECT
        pr.id,
        pr.title,
        COUNT(pp.photo_id) as photo_count
      FROM projects pr
      INNER JOIN photo_projects pp ON pp.project_id = pr.id
      GROUP BY pr.id
      HAVING COUNT(pp.photo_id) > 0
      ORDER BY pr.created_at DESC
    `,
    );

    const collectionTiles: CollectionTile[] = [];

    for (const a of albums) {
      const { collagePhotos } = await getAlbumCollage(a.id);
      collectionTiles.push({
        kind: "album",
        id: a.id,
        title: a.name,
        photoCount: a.photo_count,
        collagePhotos,
        coverEditable: true,
      });
    }

    for (const p of projects) {
      const { collagePhotos } = await getProjectCollage(p.id);
      collectionTiles.push({
        kind: "project",
        id: p.id,
        title: p.title,
        photoCount: p.photo_count,
        collagePhotos,
        coverEditable: true,
      });
    }

    res.json({ collections: collectionTiles });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[photos] GET /api/photos/collections failed", err);
    res.status(500).json({ error: "failed to load photo collections" });
  }
});

router.get("/collection", async (req, res) => {
  try {
    const db = await getDb();

    const { kind, id } = req.query as { kind?: string; id?: string };
    const collectionKind = kind === "project" ? "project" : "album";
    const collectionId = id ? Number(id) : NaN;
    if (!Number.isInteger(collectionId) || collectionId <= 0) {
      return res.status(400).json({ error: "invalid collection id" });
    }

    type PhotoRow = {
      id: number;
      title: string;
      description: string | null;
      url: string;
      original_url: string | null;
      category: string;
      taken_at: string | null;
      created_at: string;
      tags: string | null;
    };

    const baseWhere =
      collectionKind === "album"
        ? {
            sqlJoin: "INNER JOIN photo_albums pa ON pa.photo_id = p.id",
            sqlFilter: "pa.album_id = ?",
          }
        : {
            sqlJoin: "INNER JOIN photo_projects pp ON pp.photo_id = p.id",
            sqlFilter: "pp.project_id = ?",
          };

    const rows = await db.all<PhotoRow[]>(
      `
      SELECT
        p.id,
        p.title,
        p.description,
        p.url,
        p.original_url,
        p.category,
        p.taken_at,
        p.created_at,
        GROUP_CONCAT(DISTINCT t.tag) as tags
      FROM photos p
      ${baseWhere.sqlJoin}
      LEFT JOIN photo_tags t ON t.photo_id = p.id
      WHERE ${baseWhere.sqlFilter}
      GROUP BY p.id
      ORDER BY COALESCE(p.taken_at, p.created_at) DESC
    `,
      collectionId,
    );

    const photos = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      url: row.url,
      originalUrl: row.original_url,
      category: row.category,
      takenAt: row.taken_at,
      createdAt: row.created_at,
      tags: row.tags ? row.tags.split(",") : [],
    }));

    const coverOverrides = await db.all<{ slot: number; photo_id: number }[]>(
      `
      SELECT slot, photo_id
      FROM collection_covers
      WHERE collection_kind = ?
        AND collection_id = ?
      ORDER BY slot ASC
    `,
      collectionKind,
      collectionId,
    );

    const coverPhotoIds =
      coverOverrides.length > 0
        ? coverOverrides.map((c) => c.photo_id)
        : photos.slice(0, 4).map((p) => p.id);

    res.json({ photos, coverPhotoIds });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[photos] GET /api/photos/collection failed", err);
    res.status(500).json({ error: "failed to load collection photos" });
  }
});

router.get("/albums", async (_req, res) => {
  try {
    const db = await getDb();
    // eslint-disable-next-line no-console
    console.log("[photos] GET /api/photos/albums");

    const albums = await db.all<
      {
        id: number;
        name: string;
        description: string | null;
        created_at: string;
      }[]
    >("SELECT * FROM albums ORDER BY name ASC");

    res.json({ albums });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[photos] GET /api/photos/albums failed", err);
    res.status(500).json({ error: "failed to load albums" });
  }
});

export default router;

