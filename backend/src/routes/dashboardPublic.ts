import { Router } from "express";
import { getDb } from "../auth/userStore";

const router = Router();

const DASHBOARD_SETTINGS_KEY = "dashboard";

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

const FALLBACK_DASHBOARD: DashboardConfig = {
  version: 1,
  widgets: [
    { id: "market", type: "market", title: "Market", settings: { dock: "right" } },
    { id: "rss", type: "rss", title: "News" },
    { id: "systems", type: "systems", title: "Quicklinks" },
  ],
  layout: [
    { i: "rss", x: 0, y: 0, w: 8, h: 6 },
    { i: "systems", x: 8, y: 0, w: 4, h: 6 },
  ],
};

function sanitizeDashboardConfig(value: unknown): DashboardConfig {
  if (!value || typeof value !== "object") return FALLBACK_DASHBOARD;
  const v = value as Partial<DashboardConfig>;

  const version = typeof v.version === "number" && Number.isFinite(v.version) ? v.version : 1;

  const allowedTypes = new Set<DashboardWidgetType>([
    "market",
    "rss",
    "systems",
    "ai",
  ]);

  const widgets: DashboardWidget[] = Array.isArray(v.widgets)
    ? v.widgets
        .map((w) => {
          const id = typeof (w as any)?.id === "string" ? (w as any).id.trim() : "";
          const type = (w as any)?.type as DashboardWidgetType;
          if (!id || id.length > 64 || !allowedTypes.has(type)) return null;
          const title =
            typeof (w as any)?.title === "string" ? (w as any).title.trim().slice(0, 80) : undefined;
          const settings =
            (w as any)?.settings && typeof (w as any).settings === "object"
              ? ((w as any).settings as Record<string, unknown>)
              : undefined;
          return { id, type, ...(title ? { title } : {}), ...(settings ? { settings } : {}) };
        })
        .filter((x): x is DashboardWidget => x !== null)
    : FALLBACK_DASHBOARD.widgets;

  const widgetIds = new Set(widgets.map((w) => w.id));

  const layout: DashboardLayoutItem[] = Array.isArray(v.layout)
    ? v.layout
        .map((it) => {
          const i = typeof (it as any)?.i === "string" ? (it as any).i.trim() : "";
          if (!i || !widgetIds.has(i) || i.length > 64) return null;
          const x = Number((it as any)?.x);
          const y = Number((it as any)?.y);
          const w = Number((it as any)?.w);
          const h = Number((it as any)?.h);
          if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
          return {
            i,
            x: Math.max(0, Math.floor(x)),
            y: Math.max(0, Math.floor(y)),
            w: Math.max(1, Math.floor(w)),
            h: Math.max(1, Math.floor(h)),
          };
        })
        .filter((x): x is DashboardLayoutItem => x !== null)
    : FALLBACK_DASHBOARD.layout;

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

  return { version, widgets: finalWidgets, layout: layoutWithoutMarket };
}

router.get("/", async (_req, res) => {
  try {
    const db = await getDb();
    const row = await db.get<{ value: string } | undefined>(
      "SELECT value FROM settings WHERE key = ?",
      DASHBOARD_SETTINGS_KEY,
    );

    if (!row) {
      return res.json(FALLBACK_DASHBOARD);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value) as unknown;
    } catch {
      return res.json(FALLBACK_DASHBOARD);
    }

    return res.json(sanitizeDashboardConfig(parsed));
  } catch {
    return res.status(500).json({ error: "failed to load dashboard settings" });
  }
});

export default router;

