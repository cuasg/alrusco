import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WidgetRenderProps } from '../dashboard/WidgetRegistry'

type MarketDiagnostics = {
  effectiveQuoteProvider: 'alpha_vantage' | 'finnhub'
  hasAlphaVantageKey: boolean
  hasFinnhubKey: boolean
  quoteIntegrationReady: boolean
  hint: string | null
}

type Quote = {
  symbol: string
  price: number | null
  change: number | null
  changePercent: number | null
  asOf?: string
}

type SymbolSearchHit = { symbol: string; name: string; exchange?: string }

const STOCK_PRESETS = [
  'SPY',
  'QQQ',
  'DIA',
  'IWM',
  'AAPL',
  'MSFT',
  'NVDA',
  'AMZN',
  'GOOGL',
  'META',
  'TSLA',
  'XOM',
]

const LS_MARKET_WATCHLIST = 'alrusco.market.watchlist.v1'

function readLocalWatchTickers(): string[] | null {
  try {
    const raw = localStorage.getItem(LS_MARKET_WATCHLIST)
    if (!raw) return null
    const p = JSON.parse(raw) as unknown
    if (!Array.isArray(p)) return null
    const t = p
      .filter((x) => typeof x === 'string')
      .map((x) => String(x).trim().toUpperCase())
      .filter(Boolean)
    return t.length ? t : null
  } catch {
    return null
  }
}

function writeLocalWatchTickers(tickers: string[]) {
  try {
    localStorage.setItem(LS_MARKET_WATCHLIST, JSON.stringify(tickers.slice(0, 30)))
  } catch {
    /* ignore */
  }
}

/** NYSE regular session (Mon–Fri, 09:30–16:00 America/New_York). */
function isUsRegularSessionOpen(now = Date.now()): boolean {
  const d = new Date(now)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(d)
  const weekday = parts.find((p) => p.type === 'weekday')?.value
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  if (weekday === 'Sat' || weekday === 'Sun') return false
  const mins = hour * 60 + minute
  return mins >= 9 * 60 + 30 && mins < 16 * 60
}

function formatUsd(n: number) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export function MarketWidget({ editMode, isAuthenticated, layoutVariant = 'grid' }: WidgetRenderProps) {
  const [tickers, setTickers] = useState<string[]>(['SPY', 'QQQ'])
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presetTicker, setPresetTicker] = useState('SPY')
  const [saving, setSaving] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [diagnostics, setDiagnostics] = useState<MarketDiagnostics | null>(null)
  const [quotePollMeta, setQuotePollMeta] = useState({ httpOk: 0, httpFail: 0 })
  const [refreshNonce, setRefreshNonce] = useState(0)
  const emptyDiagLogAt = useRef(0)

  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [stockSearchQuery, setStockSearchQuery] = useState('')
  const [searchHits, setSearchHits] = useState<SymbolSearchHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  async function saveWatchlist(next: string[]) {
    if (!isAuthenticated) return
    setSaving(true)
    try {
      const res = await fetch('/api/market/watchlist', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (res.ok) {
        setTickers(next)
        writeLocalWatchTickers(next)
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setDiagnostics(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/market/diagnostics', { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as MarketDiagnostics
        if (!cancelled) setDiagnostics(data)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!editMode) setEditDrawerOpen(false)
  }, [editMode])

  useEffect(() => {
    if (!editDrawerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [editDrawerOpen])

  useEffect(() => {
    if (!editDrawerOpen) {
      setStockSearchQuery('')
      setSearchHits([])
      setSearchLoading(false)
      return
    }
    const q = stockSearchQuery.trim()
    if (q.length < 1) {
      setSearchHits([])
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}&limit=12`)
          if (!res.ok) {
            setSearchHits([])
            return
          }
          const data = (await res.json()) as { hits?: SymbolSearchHit[] }
          setSearchHits(Array.isArray(data.hits) ? data.hits : [])
        } catch {
          setSearchHits([])
        } finally {
          setSearchLoading(false)
        }
      })()
    }, 320)
    return () => window.clearTimeout(t)
  }, [stockSearchQuery, editDrawerOpen])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const watchRes = await fetch('/api/market/watchlist', { credentials: 'include' })

        if (watchRes.ok) {
          const data = (await watchRes.json()) as { tickers?: string[] }
          if (!cancelled && data.tickers?.length) {
            setTickers(data.tickers)
            writeLocalWatchTickers(data.tickers)
          }
        } else {
          const local = readLocalWatchTickers()
          if (!cancelled && local?.length) setTickers(local)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load market data.')
          const lt = readLocalWatchTickers()
          if (lt?.length) setTickers(lt)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  useEffect(() => {
    let cancelled = false
    let timeoutId: number

    async function loadQuotes() {
      const symbols = tickers.slice(0, 12)
      let httpOk = 0
      let httpFail = 0
      const next: Record<string, Quote | null> = {}

      if (symbols.length === 0) {
        if (!cancelled) {
          setQuotes({})
          setQuotePollMeta({ httpOk: 0, httpFail: 0 })
          setLastUpdatedAt(Date.now())
        }
        return
      }

      try {
        const res = await fetch(
          `/api/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`,
          { credentials: 'include' },
        )
        if (!res.ok) {
          httpFail = symbols.length
        } else {
          httpOk = 1
          const data = (await res.json()) as { quotes?: Record<string, Quote> }
          const qmap = data.quotes ?? {}
          for (const t of symbols) {
            next[t] = qmap[t] ?? null
          }
        }
      } catch {
        httpFail = symbols.length
        for (const t of symbols) next[t] = null
      }

      if (!cancelled) {
        setQuotes(next)
        setQuotePollMeta({ httpOk, httpFail })
        setLastUpdatedAt(Date.now())
      }
    }

    function loop() {
      void loadQuotes().finally(() => {
        if (cancelled) return
        const delay = isUsRegularSessionOpen() ? 5000 : 60_000
        timeoutId = window.setTimeout(loop, delay)
      })
    }

    void loadQuotes().finally(() => {
      if (cancelled) return
      const delay = isUsRegularSessionOpen() ? 5000 : 60_000
      timeoutId = window.setTimeout(loop, delay)
    })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [tickers, refreshNonce])

  const quoteRowSymbols = useMemo(() => tickers.slice(0, 12), [tickers])
  const quoteRowsReady = useMemo(() => {
    if (quoteRowSymbols.length === 0) return false
    return quoteRowSymbols.every((t) => Object.prototype.hasOwnProperty.call(quotes, t))
  }, [quoteRowSymbols, quotes])

  const allQuotePricesEmpty = useMemo(() => {
    if (quoteRowSymbols.length === 0 || !quoteRowsReady) return false
    return quoteRowSymbols.every((t) => {
      const q = quotes[t]
      return q == null || q.price == null
    })
  }, [quoteRowSymbols, quotes, quoteRowsReady])

  useEffect(() => {
    if (loading || !allQuotePricesEmpty || quoteRowSymbols.length === 0) return
    const now = Date.now()
    if (now - emptyDiagLogAt.current < 60_000) return
    emptyDiagLogAt.current = now

    if (quotePollMeta.httpFail > 0 && quotePollMeta.httpOk === 0) {
      console.warn(
        '[Market] /api/market/quotes request failed (non-OK or network error). Open DevTools → Network and inspect the response.',
        { quotePollMeta, symbols: quoteRowSymbols },
      )
      return
    }

    if (quotePollMeta.httpOk > 0) {
      const lines = [
        '[Market] Quote requests succeeded but all prices are empty. Common causes:',
        '• Alpha Vantage free tier rate limit (wait a minute or switch quote provider to Finnhub in Settings → Integrations).',
        '• Wrong market provider vs which API key is configured (server picks a working key when possible).',
      ]
      console.warn(lines.join('\n'), {
        diagnostics: diagnostics ?? '(sign in to load /api/market/diagnostics)',
        effectiveProvider: diagnostics?.effectiveQuoteProvider,
        quoteIntegrationReady: diagnostics?.quoteIntegrationReady,
      })
    }
  }, [loading, allQuotePricesEmpty, quoteRowSymbols, quotePollMeta, diagnostics])

  const emptyStateBanner = useMemo(() => {
    if (loading || error || !allQuotePricesEmpty || quoteRowSymbols.length === 0) return null
    if (quotePollMeta.httpFail > 0 && quotePollMeta.httpOk === 0) {
      return 'Quote requests failed (HTTP error). Open DevTools → Network, select a failed /api/market/quote request, and read the status and response body.'
    }
    if (isAuthenticated && diagnostics?.hint) return diagnostics.hint
    if (isAuthenticated && diagnostics?.quoteIntegrationReady) {
      if (diagnostics.effectiveQuoteProvider === 'finnhub') {
        return 'Finnhub is configured, but live prices are still empty. Try when US markets are open, confirm tickers are valid on Finnhub, or wait a minute if you hit rate limits.'
      }
      return 'Integration looks configured, but prices are still empty. Common causes: Alpha Vantage free-tier rate limit (wait about a minute), or markets closed. You can try switching Market provider to Finnhub under Settings → Integrations if you use a Finnhub key.'
    }
    if (!isAuthenticated) {
      return 'Sign in to verify API integration. If prices stay empty, add Alpha Vantage and/or Finnhub keys under Settings → Integrations (or set ALPHAVANTAGE_API_KEY / FINNHUB_API_KEY on the server).'
    }
    return 'If prices stay empty, configure market API keys under Settings → Integrations.'
  }, [loading, error, allQuotePricesEmpty, quoteRowSymbols.length, quotePollMeta, isAuthenticated, diagnostics])

  useEffect(() => {
    if (!editDrawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editDrawerOpen])

  async function addTickerSymbol(sym: string) {
    if (!editMode || !isAuthenticated) return
    const t = sym.trim().toUpperCase()
    if (!t) return
    const next = Array.from(new Set([...tickers, t])).slice(0, 30)
    await saveWatchlist(next)
  }

  async function addPresetTicker() {
    if (!editMode || !isAuthenticated) return
    const t = presetTicker.trim().toUpperCase()
    if (!t) return
    const next = Array.from(new Set([...tickers, t])).slice(0, 30)
    await saveWatchlist(next)
  }

  const drawer =
    editDrawerOpen && editMode && isAuthenticated
      ? createPortal(
          <div
            className="market-edit-drawer-backdrop"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setEditDrawerOpen(false)
            }}
          >
            <div
              className="market-edit-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="market-edit-drawer-title"
            >
              <div className="market-edit-drawer-header">
                <h2 id="market-edit-drawer-title" style={{ margin: 0, fontSize: 'inherit' }}>
                  Edit market
                </h2>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditDrawerOpen(false)}>
                  Close
                </button>
              </div>

              <section className="market-edit-drawer-section" aria-label="Stocks">
                <h3>Stocks</h3>
                <label className="hp-muted" style={{ fontSize: 12, display: 'block' }}>
                  Search symbols
                </label>
                <input
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  placeholder="e.g. AAPL"
                  autoComplete="off"
                />
                {searchLoading ? (
                  <p className="hp-muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                    Searching…
                  </p>
                ) : searchHits.length > 0 ? (
                  <ul className="market-edit-search-hits" style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
                    {searchHits.map((h) => (
                      <li key={h.symbol}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ width: '100%', justifyContent: 'flex-start' }}
                          onClick={() => void addTickerSymbol(h.symbol)}
                        >
                          <strong>{h.symbol}</strong>
                          <span className="hp-muted" style={{ marginLeft: 8, fontWeight: 400 }}>
                            {h.name}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : stockSearchQuery.trim().length > 0 ? (
                  <p className="hp-muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                    No matches.
                  </p>
                ) : null}

                <div className="market-edit-row" style={{ marginTop: 12 }}>
                  <select value={presetTicker} onChange={(e) => setPresetTicker(e.target.value)}>
                    {STOCK_PRESETS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => void addPresetTicker()}>
                    Add preset
                  </button>
                </div>

                <h3 style={{ marginTop: 16 }}>On your tile</h3>
                <div style={{ display: 'grid', gap: 6 }}>
                  {tickers.map((t) => (
                    <div key={t} className="market-edit-row">
                      <span>{t}</span>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={saving || tickers[0] === t}
                          onClick={() => {
                            const idx = tickers.indexOf(t)
                            if (idx <= 0) return
                            const next = [...tickers]
                            ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                            void saveWatchlist(next)
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={saving || tickers[tickers.length - 1] === t}
                          onClick={() => {
                            const idx = tickers.indexOf(t)
                            if (idx < 0 || idx >= tickers.length - 1) return
                            const next = [...tickers]
                            ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                            void saveWatchlist(next)
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={saving}
                          onClick={() => {
                            const next = tickers.filter((x) => x !== t)
                            void saveWatchlist(next)
                          }}
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>,
          document.body,
        )
      : null

  const dockClass = layoutVariant === 'dock' ? ' market-widget--dock' : ''

  return (
    <div className={`market-widget${dockClass}`}>
      {drawer}

      <div className="market-widget__toolbar">
        <p className="market-widget__toolbar-status hp-muted">
          {loading ? 'Loading…' : error ? error : 'Market'}{' '}
          {lastUpdatedAt ? (
            <span style={{ opacity: 0.8 }}>· updated {new Date(lastUpdatedAt).toLocaleTimeString()}</span>
          ) : null}
        </p>
        <div className="market-widget__toolbar-actions">
          {editMode && isAuthenticated ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditDrawerOpen(true)}>
              Edit…
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setRefreshNonce((n) => n + 1)}
          >
            Refresh
          </button>
        </div>
      </div>

      {emptyStateBanner ? (
        <div className="market-widget-hint" role="status">
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.45 }}>{emptyStateBanner}</p>
          <p style={{ margin: '8px 0 0', fontSize: 12 }} className="hp-muted">
            <a href="/settings">Settings → Integrations</a>
            {isAuthenticated ? (
              <>
                {' · '}
                Owner check:{' '}
                <code className="market-widget-code">GET /api/market/diagnostics</code> (same session)
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="market-widget__quotes" role="group" aria-label="Stock quotes">
        <div className="market-quote-row market-quote-row--head" aria-hidden="true">
          <span className="market-quote-row__sym">Symbol</span>
          <span className="market-quote-row__price">Price</span>
          <span className="market-quote-row__pct">Chg %</span>
        </div>
        {tickers.slice(0, 12).map((t) => {
          const q = quotes[t]
          const pct = q?.changePercent
          const pctText = pct == null ? '—' : `${pct.toFixed(2)}%`
          const pctColor = pct == null ? undefined : pct >= 0 ? 'var(--success-fg)' : 'var(--error-fg)'
          return (
            <div key={t} className="market-quote-row">
              <span className="market-quote-row__sym">{t}</span>
              <span className="market-quote-row__price">{q?.price == null ? '—' : formatUsd(q.price)}</span>
              <span className="market-quote-row__pct" style={{ color: pctColor }}>
                {pctText}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
