export type WidgetTypeId = 'market' | 'rss' | 'systems' | 'ai'

export type DashboardWidget = {
  id: string
  type: WidgetTypeId
  title?: string
  settings?: Record<string, unknown>
}

export type DashboardLayoutItem = {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

export type DashboardConfig = {
  version: number
  widgets: DashboardWidget[]
  layout: DashboardLayoutItem[]
}

