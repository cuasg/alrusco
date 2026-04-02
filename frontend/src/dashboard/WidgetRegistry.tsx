import type { ComponentType, LazyExoticComponent } from 'react'
import { lazy } from 'react'
import type { DashboardWidget, WidgetTypeId } from './types'

export type WidgetRenderProps = {
  widget: DashboardWidget
  editMode: boolean
  isAuthenticated: boolean
  onRequestConfigure?: () => void
  /** Side dock uses a narrower column; grid is the default dashboard tile. */
  layoutVariant?: 'grid' | 'dock'
}

type WidgetSpec = {
  type: WidgetTypeId
  displayName: string
  defaultTitle: string
  defaultW: number
  defaultH: number
  minW: number
  minH: number
  maxW?: number
  maxH?: number
  Component: LazyExoticComponent<ComponentType<WidgetRenderProps>>
}

const registry: Record<WidgetTypeId, WidgetSpec> = {
  market: {
    type: 'market',
    displayName: 'Market',
    defaultTitle: 'Market',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    Component: lazy(() => import('../widgets/MarketWidget').then((m) => ({ default: m.MarketWidget }))),
  },
  rss: {
    type: 'rss',
    displayName: 'News',
    defaultTitle: 'News',
    defaultW: 8,
    defaultH: 6,
    minW: 4,
    minH: 4,
    Component: lazy(() => import('../widgets/RssWidget').then((m) => ({ default: m.RssWidget }))),
  },
  systems: {
    type: 'systems',
    displayName: 'Quicklinks',
    defaultTitle: 'Quicklinks',
    defaultW: 4,
    defaultH: 6,
    minW: 3,
    minH: 4,
    Component: lazy(() => import('../widgets/SystemsWidget').then((m) => ({ default: m.SystemsWidget }))),
  },
  ai: {
    type: 'ai',
    displayName: 'AI Search',
    defaultTitle: 'AI Search',
    defaultW: 12,
    defaultH: 3,
    minW: 4,
    minH: 2,
    maxH: 6,
    Component: lazy(() => import('../widgets/AiSearchWidget').then((m) => ({ default: m.AiSearchWidget }))),
  },
}

export function getWidgetSpec(type: WidgetTypeId): WidgetSpec {
  return registry[type]
}

export function getAllWidgetTypes(): WidgetTypeId[] {
  return Object.keys(registry) as WidgetTypeId[]
}

export function getWidgetDisplayName(type: WidgetTypeId): string {
  return registry[type].displayName
}

