import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ColorType, createChart } from 'lightweight-charts'
import type { IChartApi, UTCTimestamp } from 'lightweight-charts'
import { useSiteTheme } from '../../hooks/useSiteTheme'
import {
  COMMODITIES,
  COMMODITY_KEYS,
  SVG_ICONS,
  getChartSymbol,
  type CategoryFilter,
  type CommodityDef,
  type CommodityKey,
} from './commodityConfig'
import { fetchAllPrices, fetchHistoricalData, type PriceData } from './commodityApi'
import { HomeWatchlistTicker } from './HomeWatchlistTicker'
import './CommodityTracker.css'

const POLL_MS = 10_000
const RANGE_OPTIONS = ['1mo', '3mo', '6mo', '1y', '2y'] as const
type RangeOption = (typeof RANGE_OPTIONS)[number]

function fmtUSD(val: number | null | undefined, decimals = 2): string {
  if (val == null || Number.isNaN(val)) return '—'
  return (
    '$' +
    val.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  )
}

function fmtChange(change: number | null | undefined, changePct: number | null | undefined) {
  if (change == null) return { text: '—', cls: 'ct-change--neutral' as const }
  const sign = change >= 0 ? '+' : ''
  const cls =
    change > 0 ? ('ct-change--up' as const) : change < 0 ? ('ct-change--down' as const) : ('ct-change--neutral' as const)
  const pct = changePct != null ? changePct : 0
  return {
    text: `${sign}${change.toFixed(2)} · ${sign}${pct.toFixed(2)}%`,
    cls,
  }
}

function fmtTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function chartColorsForTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  const cs = getComputedStyle(root)
  const bg = (cs.getPropertyValue('--surface-0').trim() || (theme === 'dark' ? '#020617' : '#ffffff')).replace(
    /;$/, ''
  )
  const text = cs.getPropertyValue('--text-muted').trim() || (theme === 'dark' ? '#a8b0c0' : '#64748b')
  const border = cs.getPropertyValue('--border-strong').trim() || (theme === 'dark' ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.18)')
  const grid =
    theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(15, 23, 42, 0.08)'
  const up = theme === 'dark' ? '#34d399' : '#059669'
  const down = theme === 'dark' ? '#f87171' : '#dc2626'
  const cross = theme === 'dark' ? 'rgba(94, 234, 212, 0.35)' : 'rgba(14, 165, 233, 0.35)'
  return { bg, text, border, grid, up, down, cross }
}

/** COMEX lead (LED=F) often returns identical OHLC on every day; candlesticks can fail to render — use a line. */
function isUniformOhlc(data: { open: number; high: number; low: number; close: number }[]): boolean {
  if (data.length < 2) return false
  const b = data[0]
  return data.every((d) => d.open === b.open && d.high === b.high && d.low === b.low && d.close === b.close)
}

type ChartModalProps = {
  open: boolean
  commodityKey: CommodityKey | null
  range: RangeOption
  theme: 'light' | 'dark'
  onClose: () => void
  onRangeChange: (r: RangeOption) => void
}

function ChartModal({ open, commodityKey, range, theme, onClose, onRangeChange }: ChartModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const resizeRef = useRef<ResizeObserver | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rangeLabel, setRangeLabel] = useState('')

  useEffect(() => {
    if (!open || !commodityKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, commodityKey, onClose])

  useEffect(() => {
    if (!open || !commodityKey || !containerRef.current) return

    const key = commodityKey
    const container = containerRef.current
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      setRangeLabel('')
      const symbol = getChartSymbol(key)
      if (!symbol) {
        setError('Chart not available')
        setLoading(false)
        return
      }

      chartRef.current?.remove()
      chartRef.current = null
      resizeRef.current?.disconnect()
      resizeRef.current = null

      try {
        const data = await fetchHistoricalData(symbol, range)
        if (cancelled) return
        if (!data?.length) {
          setError('Unable to load chart data')
          return
        }

        const colors = chartColorsForTheme(theme)
        const chart = createChart(container, {
          width: container.clientWidth,
          height: container.clientHeight,
          layout: {
            background: { type: ColorType.Solid, color: colors.bg },
            textColor: colors.text,
            fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
            fontSize: 12,
          },
          grid: {
            vertLines: { color: colors.grid },
            horzLines: { color: colors.grid },
          },
          crosshair: {
            mode: 0,
            vertLine: { color: colors.cross, width: 1, style: 2 },
            horzLine: { color: colors.cross, width: 1, style: 2 },
          },
          rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { borderColor: colors.border, timeVisible: false },
          handleScroll: true,
          handleScale: true,
        })

        chartRef.current = chart

        const useLine = isUniformOhlc(data)
        if (useLine) {
          const line = chart.addLineSeries({
            color: colors.up,
            lineWidth: 2,
          })
          line.setData(
            data.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.close,
            }))
          )
        } else {
          const series = chart.addCandlestickSeries({
            upColor: colors.up,
            downColor: colors.down,
            borderDownColor: colors.down,
            borderUpColor: colors.up,
            wickDownColor: colors.down,
            wickUpColor: colors.up,
          })
          series.setData(
            data.map((d) => ({
              time: d.time as UTCTimestamp,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
            }))
          )
        }

        chart.timeScale().fitContent()

        const first = new Date(data[0].time * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        const last = new Date(data[data.length - 1].time * 1000).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
        const unit = useLine ? 'points' : 'candles'
        setRangeLabel(`${first} — ${last} · ${data.length} ${unit}`)

        const ro = new ResizeObserver(() => {
          if (chartRef.current && container) {
            chartRef.current.applyOptions({ width: container.clientWidth, height: container.clientHeight })
          }
        })
        ro.observe(container)
        resizeRef.current = ro
      } catch {
        setError('Unable to render chart')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
      resizeRef.current?.disconnect()
      resizeRef.current = null
      chartRef.current?.remove()
      chartRef.current = null
    }
  }, [open, commodityKey, range, theme])

  if (!open || !commodityKey) return null

  const config = COMMODITIES[commodityKey]
  const symLabel = getChartSymbol(commodityKey) ?? commodityKey.toUpperCase()

  return (
    <div className="ct-chart-modal" role="dialog" aria-modal="true" aria-labelledby="ct-chart-title">
      <button type="button" className="ct-chart-modal__backdrop" aria-label="Close chart" onClick={onClose} />
      <div className="ct-chart-modal__panel">
        <div className="ct-chart-modal__head">
          <div>
            <h2 id="ct-chart-title" className="ct-chart-modal__title">
              {config.name} — Historical
            </h2>
            <p className="ct-chart-modal__sub">
              {symLabel} · Yahoo Finance
            </p>
            {config.yahooSymbol && symLabel !== config.yahooSymbol ? (
              <p className="ct-chart-modal__hint">Spot on card: {config.yahooSymbol}</p>
            ) : null}
          </div>
          <button type="button" className="ct-chart-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="ct-chart-modal__tf">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={`ct-tf-btn${range === r ? ' ct-tf-btn--active' : ''}`}
              onClick={() => onRangeChange(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="ct-chart-modal__canvas-wrap">
          {loading ? (
            <div className="ct-chart-loading">Loading chart data…</div>
          ) : error ? (
            <div className="ct-chart-loading ct-chart-loading--err">{error}</div>
          ) : null}
          <div ref={containerRef} className="ct-chart-container" />
        </div>

        {rangeLabel ? <p className="ct-chart-range-meta">{rangeLabel}</p> : null}
      </div>
    </div>
  )
}

function categoryBadgeClass(cat: CommodityDef['category']): string {
  switch (cat) {
    case 'precious':
      return 'ct-cat-badge ct-cat-badge--precious'
    case 'industrial':
      return 'ct-cat-badge ct-cat-badge--industrial'
    case 'energy':
      return 'ct-cat-badge ct-cat-badge--energy'
    default:
      return 'ct-cat-badge'
  }
}

type CardProps = {
  commodityKey: CommodityKey
  config: CommodityDef
  priceData: PriceData | undefined
  errorText: string | undefined
  lastUpdate: Date | null
  onOpenChart: (key: CommodityKey) => void
}

function CommodityCard({ commodityKey, config, priceData, errorText, lastUpdate, onOpenChart }: CardProps) {
  const change = priceData ? fmtChange(priceData.change, priceData.changePct) : fmtChange(null, null)
  const intlPriceStr = priceData ? fmtUSD(priceData.price) : errorText ? '—' : '…'
  const isApprox = priceData?.isApprox
  const isLME = priceData?.isLME
  const changeProxyTitle =
    priceData?.changeIsProxy && config.changeProxyYahooSymbol
      ? `Daily change from ${config.changeProxyYahooSymbol} (base metals ETF). Spot from ${config.yahooSymbol ?? 'n/a'}.`
      : undefined

  const showChartBtn = Boolean(config.yahooSymbol)

  return (
    <article
      className="ct-card"
      style={{ ['--ct-accent' as string]: config.accentColor }}
      data-category={config.category}
    >
      <div className="ct-card__inner">
        <header className="ct-card__header">
          <div className="ct-card__title-row">
            <div
              className="ct-card__icon"
              style={{
                background: `linear-gradient(135deg, ${config.accentBg}, ${config.accentColor})`,
              }}
            >
              <span className="ct-card__icon-svg" dangerouslySetInnerHTML={{ __html: config.icon }} />
            </div>
            <div className="ct-card__names">
              <div className="ct-card__name">{config.name}</div>
              <div className="ct-card__symbol">{config.symbol}</div>
            </div>
          </div>
          <span className={categoryBadgeClass(config.category)}>{config.categoryLabel}</span>
        </header>

        <div className="ct-card__price-row">
          <div>
            <div className="ct-card__intl-price">
              {intlPriceStr}
              {isApprox ? (
                <span className="ct-badge-approx">~APPROX</span>
              ) : isLME ? (
                <span className="ct-badge-lme">LME</span>
              ) : null}
            </div>
            <div className="ct-card__intl-unit">/ {config.intlUnit.toLowerCase()}</div>
          </div>
          <div className="ct-card__change-wrap">
            <span className={`ct-change-pill ${change.cls}`} title={changeProxyTitle}>
              {change.text}
            </span>
          </div>
        </div>

        <div className="ct-ref">
          <div className="ct-ref__head">
            <span className="ct-ref__title">USD reference · unit conversions</span>
            {showChartBtn ? (
              <button
                type="button"
                className="ct-chart-btn"
                onClick={() => onOpenChart(commodityKey)}
              >
                <span className="ct-chart-btn__svg" dangerouslySetInnerHTML={{ __html: SVG_ICONS.chart }} />
                Chart
              </button>
            ) : null}
          </div>
          <div className="ct-ref__rows">
            {!priceData && !errorText ? (
              <div className="ct-price-row">
                <span className="ct-price-label">Loading…</span>
                <span className="ct-price-value">—</span>
              </div>
            ) : errorText && !priceData ? (
              <div className="ct-price-row">
                <span className="ct-price-label">{errorText}</span>
                <span className="ct-price-value">—</span>
              </div>
            ) : priceData ? (
              <>
                <div className="ct-price-row">
                  <span className="ct-price-label">Per {config.intlUnit.toLowerCase()}</span>
                  <span className="ct-price-value ct-price-value--hl">{fmtUSD(priceData.price)}</span>
                </div>
                {config.conversions.map((c, i) => {
                  const val = priceData.price / c.divisor
                  return (
                    <div key={i} className="ct-price-row">
                      <span className="ct-price-label">{c.label}</span>
                      <span className={`ct-price-value${c.highlight ? ' ct-price-value--hl' : ''}`}>
                        {fmtUSD(val, c.decimals)}
                        {c.unit ? `/${c.unit}` : ''}
                      </span>
                    </div>
                  )
                })}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="ct-card__source">
        <span>
          Source:{' '}
          {isLME
            ? 'metals.live (LME)'
            : isApprox
              ? 'LME Approx'
              : priceData?.changeIsProxy && config.changeProxyYahooSymbol
                ? `Yahoo Finance · spot ${config.yahooSymbol} · daily Δ% ${config.changeProxyYahooSymbol}`
                : `Yahoo Finance (${config.yahooSymbol ?? 'N/A'})`}
        </span>
        <span>{fmtTime(lastUpdate)}</span>
      </footer>
    </article>
  )
}

export function CommodityTracker() {
  const siteTheme = useSiteTheme()
  const [searchParams] = useSearchParams()
  const [prices, setPrices] = useState<Partial<Record<CommodityKey, PriceData>>>({})
  const [errors, setErrors] = useState<Partial<Record<CommodityKey, string>>>({})
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [chartOpen, setChartOpen] = useState(false)
  const [chartKey, setChartKey] = useState<CommodityKey | null>(null)
  const [chartRange, setChartRange] = useState<RangeOption>('1y')
  const [refreshBusy, setRefreshBusy] = useState(false)

  const pricesRef = useRef(prices)
  pricesRef.current = prices

  useEffect(() => {
    const cat = searchParams.get('cat')
    if (cat && ['precious', 'industrial', 'energy', 'all'].includes(cat)) {
      setActiveCategory(cat as CategoryFilter)
    }
  }, [searchParams])

  const load = useCallback(async () => {
    const { prices: next, errors: err } = await fetchAllPrices(pricesRef.current)
    setPrices(next)
    setErrors(err)
    setLastUpdate(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  async function handleRefresh() {
    if (refreshBusy) return
    setRefreshBusy(true)
    await load()
    setRefreshBusy(false)
  }

  const filteredKeys = COMMODITY_KEYS.filter((key) => {
    if (activeCategory === 'all') return true
    return COMMODITIES[key].category === activeCategory
  })

  const hasAnyData = Object.keys(prices).length > 0
  const errCount = Object.keys(errors).length
  let statusText = 'OFFLINE'
  let statusClass = 'ct-status-pill ct-status-pill--err'
  if (hasAnyData && errCount === 0) {
    statusText = 'LIVE'
    statusClass = 'ct-status-pill'
  } else if (hasAnyData) {
    statusText = `PARTIAL (${errCount} ERR)`
    statusClass = 'ct-status-pill ct-status-pill--warn'
  } else if (loading) {
    statusText = 'LOADING'
    statusClass = 'ct-status-pill ct-status-pill--err'
  }

  function openChart(key: CommodityKey) {
    setChartKey(key)
    setChartRange('1y')
    setChartOpen(true)
  }

  function closeChart() {
    setChartOpen(false)
    setChartKey(null)
  }

  const cats: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'precious', label: 'Precious' },
    { id: 'industrial', label: 'Industrial' },
    { id: 'energy', label: 'Energy' },
  ]

  return (
    <div className="ct-root">
      <div className="ct-watchlist-ticker-bleed">
        <HomeWatchlistTicker />
      </div>
      <header className="ct-hero">
        <div className="ct-hero__top">
          <div>
            <h1 className="ct-hero__title">US Commodity Tracker</h1>
          </div>
          <div className="ct-hero__actions">
            <span className={statusClass}>{statusText}</span>
            <button
              type="button"
              className="ct-refresh-btn"
              disabled={refreshBusy}
              onClick={handleRefresh}
            >
              <span
                className="ct-refresh-btn__icon"
                dangerouslySetInnerHTML={{ __html: SVG_ICONS.refresh }}
              />
              {refreshBusy ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="ct-cat-tabs" role="tablist" aria-label="Category">
          {cats.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeCategory === id}
              className={`ct-cat-tab${activeCategory === id ? ' ct-cat-tab--active' : ''}`}
              onClick={() => setActiveCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="ct-grid">
        {filteredKeys.map((key) => (
          <CommodityCard
            key={key}
            commodityKey={key}
            config={COMMODITIES[key]}
            priceData={prices[key]}
            errorText={errors[key]}
            lastUpdate={lastUpdate}
            onOpenChart={openChart}
          />
        ))}
      </div>

      <ChartModal
        open={chartOpen}
        commodityKey={chartKey}
        range={chartRange}
        theme={siteTheme}
        onClose={closeChart}
        onRangeChange={setChartRange}
      />
    </div>
  )
}
