import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Layout } from 'react-grid-layout'
import GridLayoutBase from 'react-grid-layout'
import type { DashboardConfig, DashboardLayoutItem, DashboardWidget } from './types'

const GridLayout = GridLayoutBase as unknown as React.ComponentType<any>

/** Matches `dashboard-shell` single-column stack in App.css (max-width: 1024px). */
function useMobileDashboardShell(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia('(max-width: 1024px)')
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia('(max-width: 1024px)').matches,
    () => false,
  )
}

/** Full-width column: read order top-to-bottom, left-to-right as on desktop. */
function stackLayoutSingleColumn(items: Layout): Layout {
  if (items.length === 0) return items
  const sorted = [...items].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })
  let curY = 0
  return sorted.map((it) => {
    const h = Math.max(1, Math.floor(it.h))
    const next = { ...it, x: 0, w: 1, y: curY, h }
    curY += h
    return next
  })
}

type Props = {
  config: DashboardConfig
  editMode: boolean
  onLayoutChange: (layout: DashboardLayoutItem[]) => void
  renderWidget: (w: DashboardWidget) => React.ReactNode
}

function toRglLayout(items: DashboardLayoutItem[]): Layout {
  return items.map((it) => ({ ...it }))
}

function fromRglLayout(items: Layout): DashboardLayoutItem[] {
  return items.map((it) => ({
    i: it.i,
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.h,
    minW: it.minW,
    minH: it.minH,
    maxW: it.maxW,
    maxH: it.maxH,
  }))
}

export function DashboardGrid({ config, editMode, onLayoutChange, renderWidget }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState<number>(1200)
  // Only the viewport breakpoint controls “mobile stack” mode. Do not use the
  // grid’s measured width here: with a docked Market sidebar the main column
  // can be <560px wide on desktop, which must still allow drag/resize + saves.
  const mobileShell = useMobileDashboardShell()
  // One column on the stacked mobile shell so tile width matches the full-width Market dock.
  // Wider viewports: keep 12 cols for desktop so persisted layouts stay usable.
  const cols = mobileShell
    ? 1
    : width >= 900
      ? 12
      : width >= 720
        ? 8
        : width >= 520
          ? 6
          : 2
  const layout = useMemo(() => {
    const raw = toRglLayout(config.layout)
    let next: Layout = raw.map((it) => {
      const w = Math.max(1, Math.min(Math.floor(it.w), cols))
      const x = Math.max(0, Math.min(Math.floor(it.x), Math.max(0, cols - w)))
      const y = Math.max(0, Math.floor(it.y))
      const h = Math.max(1, Math.floor(it.h))
      return { ...it, x, y, w, h }
    })
    if (cols === 1) {
      next = stackLayoutSingleColumn(next)
    }
    return next
  }, [config.layout, cols])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (typeof w === 'number' && Number.isFinite(w) && w > 0) {
        setWidth(w)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="dash-grid" ref={wrapRef}>
      <GridLayout
        className="layout"
        layout={layout}
        cols={cols}
        width={width}
        rowHeight={30}
        margin={mobileShell ? [0, 18] : [18, 18]}
        containerPadding={mobileShell ? [0, 0] : [8, 8]}
        isDraggable={editMode && !mobileShell}
        isResizable={editMode && !mobileShell}
        draggableHandle=".dash-drag-handle"
        compactType="vertical"
        preventCollision={!editMode}
        onLayoutChange={(next: Layout) => {
          // Stacked mobile layout is display-only; never overwrite persisted multi-column layout.
          if (!editMode || mobileShell) return
          onLayoutChange(fromRglLayout(next))
        }}
      >
        {config.widgets.map((w) => (
          <div key={w.id}>{renderWidget(w)}</div>
        ))}
      </GridLayout>
    </div>
  )
}

