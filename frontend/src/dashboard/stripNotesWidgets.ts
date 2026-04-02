import type { DashboardConfig } from './types'

/** Remove legacy `notes` tiles from saved layouts (notes live in the nav modal now). */
export function stripNotesWidgets(cfg: DashboardConfig, fallbackIfEmpty: DashboardConfig): DashboardConfig {
  const widgets = cfg.widgets.filter((w) => (w.type as string) !== 'notes')
  const ids = new Set(widgets.map((w) => w.id))
  const layout = cfg.layout.filter((l) => ids.has(l.i))
  if (widgets.length === 0) return fallbackIfEmpty
  return { ...cfg, widgets, layout }
}
