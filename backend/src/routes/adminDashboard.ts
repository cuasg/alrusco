import { Router } from "express";
import { requireAuth } from "../auth/authMiddleware";
import { getDb } from "../auth/userStore";

const router = Router();
router.use(requireAuth);

const DASHBOARD_SETTINGS_KEY = "dashboard";
const MAX_DASHBOARD_PAYLOAD_BYTES = 128 * 1024; // 128KB

type DashboardWidgetType = "market" | "rss" | "systems" | "ai";

type DashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  title?: string;
  settings?: Record<string, unknown>;
};

type DashboardLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

type DashboardConfig = {
  version: number;
  widgets: DashboardWidget[];
  layout: DashboardLayoutItem[];
};

function normalizeDashboardConfig(input: unknown): { config?: DashboardConfig; errors?: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return { errors: ["settings payload must be an object"] };
  }

  const v = input as Partial<DashboardConfig>;
  const version =
    typeof v.version === "number" && Number.isFinite(v.version) ? v.version : 1;

  const allowedTypes = new Set<DashboardWidgetType>([
    "market",
    "rss",
    "systems",
    "ai",
  ]);

  if (!Array.isArray(v.widgets) || v.widgets.length === 0) {
    errors.push("widgets must be a non-empty array");
  }

  const widgets: DashboardWidget[] = Array.isArray(v.widgets)
    ? v.widgets
        .map((w) => {
          const id = typeof (w as any)?.id === "string" ? (w as any).id.trim() : "";
          const type = (w as any)?.type as DashboardWidgetType;
          if (!id) {
            errors.push("widget id required");
            return null;
          }
          if (id.length > 64) {
            errors.push("widget id too long");
            return null;
          }
          if (!allowedTypes.has(type)) {
            errors.push(`invalid widget type for ${id}`);
            return null;
          }
          const title =
            typeof (w as any)?.title === "string" ? (w as any).title.trim() : undefined;
          const safeTitle = title ? title.slice(0, 80) : undefined;
          const settings =
            (w as any)?.settings && typeof (w as any).settings === "object"
              ? ((w as any).settings as Record<string, unknown>)
              : undefined;
          return { id, type, ...(safeTitle ? { title: safeTitle } : {}), ...(settings ? { settings } : {}) };
        })
        .filter((x): x is DashboardWidget => x !== null)
    : [];

  const ids = new Set(widgets.map((w) => w.id));

  if (!Array.isArray(v.layout) || v.layout.length === 0) {
    errors.push("layout must be a non-empty array");
  }

  const layout: DashboardLayoutItem[] = Array.isArray(v.layout)
    ? v.layout
        .map((it) => {
          const i = typeof (it as any)?.i === "string" ? (it as any).i.trim() : "";
          if (!i) {
            errors.push("layout item i required");
            return null;
          }
          if (!ids.has(i)) {
            errors.push(`layout item refers to unknown widget id: ${i}`);
            return null;
          }
          const x = Number((it as any)?.x);
          const y = Number((it as any)?.y);
          const w = Number((it as any)?.w);
          const h = Number((it as any)?.h);
          if (![x, y, w, h].every((n) => Number.isFinite(n))) {
            errors.push(`invalid layout numbers for ${i}`);
            return null;
          }
          return {
            i,
            x: Math.max(0, Math.floor(x)),
            y: Math.max(0, Math.floor(y)),
            w: Math.max(1, Math.floor(w)),
            h: Math.max(1, Math.floor(h)),
          };
        })
        .filter((x): x is DashboardLayoutItem => x !== null)
    : [];

  if (errors.length) return { errors };

  const marketIds = new Set(widgets.filter((w) => w.type === "market").map((w) => w.id));
  const layoutWithoutMarket = layout.filter((l) => !marketIds.has(l.i));

  const marketWidgets = widgets.filter((w) => w.type === "market");
  const nonMarket = widgets.filter((w) => w.type !== "market");
  const mergedMarket =
    marketWidgets.length > 0
      ? (() => {
          const m = marketWidgets[0];
          const dock = m.settings?.dock === "left" ? "left" : "right";
          return { ...m, settings: { ...m.settings, dock } };
        })()
      : null;
  const finalWidgets = mergedMarket ? [...nonMarket, mergedMarket] : nonMarket;

  return { config: { version, widgets: finalWidgets, layout: layoutWithoutMarket } };
}

router.get("/", async (_req, res) => {
  try {
    const db = await getDb();
    const row = await db.get<{ value: string } | undefined>(
      "SELECT value FROM settings WHERE key = ?",
      DASHBOARD_SETTINGS_KEY,
    );
    if (!row) {
      return res.status(404).json({ error: "not found" });
    }
    return res.json(JSON.parse(row.value));
  } catch {
    return res.status(500).json({ error: "failed to load dashboard settings" });
  }
});

router.put("/", async (req, res) => {
  const settings = req.body as unknown;
  if (settings === null || settings === undefined) {
    return res.status(400).json({ error: "settings payload is required" });
  }

  try {
    const payloadSize = JSON.stringify(settings).length;
    if (payloadSize > MAX_DASHBOARD_PAYLOAD_BYTES) {
      return res.status(400).json({
        error: `settings payload too large (max ${MAX_DASHBOARD_PAYLOAD_BYTES} bytes)`,
      });
    }
  } catch {
    return res.status(400).json({ error: "invalid settings payload" });
  }

  const { config, errors } = normalizeDashboardConfig(settings);
  if (!config || (errors && errors.length)) {
    return res.status(400).json({ error: errors?.join(", ") || "invalid settings payload" });
  }

  try {
    const db = await getDb();
    const value = JSON.stringify(config);
    await db.run(
      `
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      DASHBOARD_SETTINGS_KEY,
      value,
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "failed to update dashboard settings" });
  }
});

export default router;

