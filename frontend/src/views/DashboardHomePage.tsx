import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../hooks/useAuth'
import { DashboardGrid } from '../dashboard/DashboardGrid'
import type { DashboardConfig, DashboardLayoutItem, DashboardWidget, WidgetTypeId } from '../dashboard/types'
import { fetchAdminDashboard, fetchPublicDashboard, saveAdminDashboard } from '../dashboard/api'
import { stripNotesWidgets } from '../dashboard/stripNotesWidgets'
import {
  gridConfigWithoutMarket,
  getMarketWidget,
  normalizeMarketDockConfig,
  parseDockSide,
  type MarketDockSide,
} from '../dashboard/marketDock'
import { getAllWidgetTypes, getWidgetDisplayName, getWidgetSpec } from '../dashboard/WidgetRegistry'
import { WidgetFrame } from '../dashboard/WidgetFrame'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

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

const FALLBACK_DASHBOARD: DashboardConfig = {
  version: 1,
  widgets: [
    { id: 'market', type: 'market', title: 'Market' },
    { id: 'rss', type: 'rss', title: 'News' },
    { id: 'systems', type: 'systems', title: 'Quicklinks' },
  ],
  layout: [
    { i: 'market', x: 0, y: 0, w: 6, h: 4 },
    { i: 'rss', x: 0, y: 4, w: 8, h: 6 },
    { i: 'systems', x: 8, y: 4, w: 4, h: 6 },
  ],
}
const LOCAL_DASHBOARD_KEY = 'alrusco.dashboard.local.v1'

function normalizeDashboardInput(data: DashboardConfig): DashboardConfig {
  const widgets = data.widgets.filter((w) => w.type !== 'ai')
  const ids = new Set(widgets.map((w) => w.id))
  const layout = data.layout.filter((l) => ids.has(l.i))
  const noAi: DashboardConfig = { ...data, widgets, layout }
  const noNotes = stripNotesWidgets(noAi, FALLBACK_DASHBOARD)
  return normalizeMarketDockConfig(noNotes)
}

export function DashboardHomePage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<DashboardConfig>(FALLBACK_DASHBOARD)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimer = useRef<number | null>(null)
  const latestConfigRef = useRef<DashboardConfig>(config)
  const editModeRef = useRef(editMode)
  const mobileShell = useMobileDashboardShell()

  const persistDashboardNow = useCallback(async (nextConfig: DashboardConfig) => {
    try {
      if (user) {
        const ok = await saveAdminDashboard(nextConfig)
        if (!ok) setSaveError('Could not save dashboard to your account.')
        else setSaveError(null)
      } else {
        try {
          window.localStorage.setItem(LOCAL_DASHBOARD_KEY, JSON.stringify(nextConfig))
          setSaveError(null)
        } catch {
          setSaveError('Could not save dashboard locally.')
        }
      }
    } catch {
      setSaveError(user ? 'Could not save dashboard.' : 'Could not save dashboard locally.')
    } finally {
      setSavingLayout(false)
    }
  }, [user])

  const now = useMemo(() => new Date(), [])
  const [clock, setClock] = useState(now)
  const [globalQuery, setGlobalQuery] = useState('')

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        if (user) {
          const adminData = await fetchAdminDashboard()
          if (!cancelled && adminData) {
            setConfig(normalizeDashboardInput(adminData))
            return
          }
        }

        if (!user) {
          try {
            const raw = window.localStorage.getItem(LOCAL_DASHBOARD_KEY)
            if (raw) {
              const parsed = JSON.parse(raw) as DashboardConfig
              if (!cancelled && parsed?.widgets?.length && parsed?.layout?.length) {
                setConfig(normalizeDashboardInput(parsed))
                return
              }
            }
          } catch {
            // ignore local parse issues
          }
        }

        const publicData = await fetchPublicDashboard()
        if (!cancelled && publicData) {
          setConfig(normalizeDashboardInput(publicData))
        }
      } catch (e) {
        if (!cancelled) setError('Using default dashboard while live data loads.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    latestConfigRef.current = config
  }, [config])

  useEffect(() => {
    if (!user) {
      setEditMode(false)
      setAddOpen(false)
    }
  }, [user])

  useEffect(() => {
    editModeRef.current = editMode
  }, [editMode])

  /** If the user leaves edit mode while a debounced save is still pending, flush it immediately. */
  useEffect(() => {
    if (editMode) return
    if (!saveTimer.current) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = null
    void persistDashboardNow(latestConfigRef.current)
  }, [editMode, persistDashboardNow])

  // On mobile (single column), render Market as a normal tile inside the grid so
  // it shares identical width/stacking rules with the other widgets.
  const gridConfig = useMemo(() => (mobileShell ? config : gridConfigWithoutMarket(config)), [config, mobileShell])
  const marketWidget = useMemo(() => getMarketWidget(config), [config])
  const marketDockSide = marketWidget ? parseDockSide(marketWidget.settings?.dock) : 'right'

  function persistConfigDebounced(nextConfig: DashboardConfig) {
    setSaveError(null)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setSavingLayout(true)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null
      void persistDashboardNow(nextConfig)
    }, 400)
  }

  function scheduleSave(nextConfig: DashboardConfig) {
    if (!editModeRef.current) return
    persistConfigDebounced(nextConfig)
  }

  function updateMarketDock(side: MarketDockSide) {
    setConfig((prev) => {
      const mw = getMarketWidget(prev)
      if (!mw) return prev
      const next: DashboardConfig = {
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === mw.id ? { ...w, settings: { ...w.settings, dock: side } } : w,
        ),
      }
      persistConfigDebounced(next)
      return next
    })
  }

  function removeWidget(id: string) {
    setConfig((prev) => {
      const next: DashboardConfig = {
        ...prev,
        widgets: prev.widgets.filter((w) => w.id !== id),
        layout: prev.layout.filter((l) => l.i !== id),
      }
      scheduleSave(next)
      return next
    })
  }

  function addWidget(type: WidgetTypeId) {
    const spec = getWidgetSpec(type)
    setConfig((prev) => {
      if (type === 'market') {
        if (prev.widgets.some((w) => w.type === 'market')) return prev
        const id = `market-${Math.random().toString(36).slice(2, 8)}`
        const next: DashboardConfig = {
          ...prev,
          widgets: [
            ...prev.widgets,
            { id, type: 'market', title: spec.defaultTitle, settings: { dock: 'right' } },
          ],
          layout: prev.layout,
        }
        scheduleSave(next)
        return next
      }

      const id = `${type}-${Math.random().toString(36).slice(2, 8)}`
      const yMax = prev.layout.reduce((m, it) => Math.max(m, it.y + it.h), 0)
      const layoutItem: DashboardLayoutItem = {
        i: id,
        x: 0,
        y: yMax,
        w: spec.defaultW,
        h: spec.defaultH,
        minW: spec.minW,
        minH: spec.minH,
        ...(spec.maxW ? { maxW: spec.maxW } : {}),
        ...(spec.maxH ? { maxH: spec.maxH } : {}),
      }
      const next: DashboardConfig = {
        ...prev,
        widgets: [...prev.widgets, { id, type, title: spec.defaultTitle }],
        layout: [...prev.layout, layoutItem],
      }
      scheduleSave(next)
      return next
    })
  }

  function renderWidget(w: DashboardWidget) {
    const spec = getWidgetSpec(w.type)
    const title = w.title?.trim() || spec.defaultTitle
    const Component = spec.Component
    return (
      <WidgetFrame
        title={title}
        editMode={editMode}
        onRemove={editMode ? () => removeWidget(w.id) : undefined}
        onConfigure={editMode ? () => {} : undefined}
      >
        <Suspense fallback={<p className="hp-muted">Loading widget…</p>}>
          <Component
            widget={w}
            editMode={editMode}
            isAuthenticated={Boolean(user)}
            layoutVariant="grid"
          />
        </Suspense>
      </WidgetFrame>
    )
  }

  function renderMarketDock(w: DashboardWidget) {
    const spec = getWidgetSpec('market')
    const title = w.title?.trim() || spec.defaultTitle
    const Component = spec.Component
    const dockSide = parseDockSide(w.settings?.dock)
    const dockControls = (
      <div className="dash-market-dock__switch" role="group" aria-label="Dock market panel">
        <button
          type="button"
          className={`btn btn-ghost btn-sm${dockSide === 'left' ? ' dash-market-dock__switch-btn--active' : ''}`}
          onClick={() => updateMarketDock('left')}
        >
          Left
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-sm${dockSide === 'right' ? ' dash-market-dock__switch-btn--active' : ''}`}
          onClick={() => updateMarketDock('right')}
        >
          Right
        </button>
      </div>
    )
    return (
      <WidgetFrame
        title={title}
        editMode={editMode}
        showDragHandle={false}
        headerTrailing={dockControls}
        onRemove={editMode ? () => removeWidget(w.id) : undefined}
        onConfigure={editMode ? () => {} : undefined}
      >
        <Suspense fallback={<p className="hp-muted">Loading widget…</p>}>
          <Component
            widget={w}
            editMode={editMode}
            isAuthenticated={Boolean(user)}
            layoutVariant="dock"
          />
        </Suspense>
      </WidgetFrame>
    )
  }

  function submitGlobalSearch(kind: 'chatgpt' | 'web') {
    const q = globalQuery.trim()
    if (!q) return
    const url =
      kind === 'chatgpt'
        ? `https://chatgpt.com/?q=${encodeURIComponent(q)}`
        : `https://www.google.com/search?q=${encodeURIComponent(q)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section
      className={`page dashboard-home-page${marketWidget ? ` dashboard-home-page--with-market dashboard-home-page--dock-${marketDockSide}` : ''}`}
    >
      <header className="dash-globalbar card">
        <div className="dash-globalbar-left">
          <div className="dash-clock">
            <div className="dash-time">{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="dash-date">
              {clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit' })}
            </div>
          </div>
          <div className="dash-search">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submitGlobalSearch('chatgpt')
              }}
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <input
                placeholder="Search…"
                aria-label="Global search"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Ask
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => submitGlobalSearch('web')}
              >
                Web
              </button>
            </form>
          </div>
        </div>

        <div className="dash-globalbar-right">
          {user && (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setEditMode((v) => !v)}>
                {editMode ? 'Done' : 'Edit mode'}
              </button>
              {(editMode || savingLayout) && (
                <span className="hp-muted dash-save-status" style={{ marginRight: 6 }}>
                  {savingLayout ? 'Saving…' : 'Saved to account'}
                </span>
              )}
              <button type="button" className="btn" onClick={() => setAddOpen(true)} disabled={!editMode}>
                Add widget
              </button>
            </>
          )}
        </div>
      </header>

      {saveError && (
        <p className="hp-muted" role="status" style={{ color: 'var(--error-fg)' }}>
          {saveError}
        </p>
      )}

      {(loading || error) && (
        <p className="hp-muted" role="status">
          {loading ? 'Loading…' : error}
        </p>
      )}

      <div className="dashboard-shell">
        {marketWidget && !mobileShell && marketDockSide === 'left' && (
          <aside className="dash-market-dock" aria-label="Market">
            {renderMarketDock(marketWidget)}
          </aside>
        )}

        <div className="dashboard-shell-main">
          <DashboardGrid
            config={gridConfig}
            editMode={editMode}
            onLayoutChange={(next) => {
              setConfig((prev) => {
                const merged: DashboardConfig = { ...prev, layout: next }
                scheduleSave(merged)
                return merged
              })
            }}
            renderWidget={renderWidget}
          />
        </div>

        {marketWidget && !mobileShell && marketDockSide === 'right' && (
          <aside className="dash-market-dock" aria-label="Market">
            {renderMarketDock(marketWidget)}
          </aside>
        )}
      </div>

      {editMode && addOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAddOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Add widget</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen(false)}>
                Close
              </button>
            </header>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: 10 }}>
                {getAllWidgetTypes()
                  .filter(
                    (t) =>
                      t !== 'ai' && (t !== 'market' || !config.widgets.some((w) => w.type === 'market')),
                  )
                  .map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      addWidget(t)
                      setAddOpen(false)
                    }}
                  >
                    {getWidgetDisplayName(t)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
