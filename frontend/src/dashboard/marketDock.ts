import type { DashboardConfig, DashboardWidget } from './types'

export type MarketDockSide = 'left' | 'right'

export function parseDockSide(raw: unknown): MarketDockSide {
  return raw === 'left' ? 'left' : 'right'
}

/** Keep a single market widget, normalize dock setting, and remove grid layout rows for market. */
export function normalizeMarketDockConfig(cfg: DashboardConfig): DashboardConfig {
  const markets = cfg.widgets.filter((w) => w.type === 'market')
  const nonMarket = cfg.widgets.filter((w) => w.type !== 'market')
  const marketIds = new Set(markets.map((m) => m.id))

  const layoutWithoutMarket = cfg.layout.filter((l) => !marketIds.has(l.i))

  if (markets.length === 0) {
    return { ...cfg, widgets: nonMarket, layout: layoutWithoutMarket }
  }

  const primary = markets[0]
  const dock = parseDockSide(primary.settings?.dock)
  const market: DashboardWidget = {
    ...primary,
    settings: { ...primary.settings, dock },
  }

  const widgets = [...nonMarket, market]
  const ids = new Set(widgets.map((w) => w.id))
  const layout = layoutWithoutMarket.filter((l) => ids.has(l.i))

  return { ...cfg, widgets, layout }
}

export function getMarketWidget(cfg: DashboardConfig): DashboardWidget | null {
  return cfg.widgets.find((w) => w.type === 'market') ?? null
}

/** Config passed to the grid: no market tile (market is docked in the shell). */
export function gridConfigWithoutMarket(cfg: DashboardConfig): DashboardConfig {
  const widgets = cfg.widgets.filter((w) => w.type !== 'market')
  const ids = new Set(widgets.map((w) => w.id))
  const layout = cfg.layout.filter((l) => ids.has(l.i))
  return { ...cfg, widgets, layout }
}
