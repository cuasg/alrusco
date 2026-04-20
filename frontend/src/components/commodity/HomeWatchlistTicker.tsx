import { useEffect, useState } from 'react'
import { isUsRegularSessionOpen } from '../../lib/marketSession'
import { getEffectiveWatchlistTickers, subscribeMarketWatchlist } from '../../lib/marketWatchlist'
import './HomeWatchlistTicker.css'

type Quote = {
  symbol: string
  price: number | null
  change: number | null
  changePercent: number | null
}

function formatPrice(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatChange(q: Quote | null | undefined): { text: string; dir: 'up' | 'down' | 'flat' } {
  if (!q || q.changePercent == null || Number.isNaN(q.changePercent)) {
    return { text: '', dir: 'flat' }
  }
  const p = q.changePercent
  const sign = p > 0 ? '+' : ''
  const dir = p > 0 ? 'up' : p < 0 ? 'down' : 'flat'
  return { text: `${sign}${p.toFixed(2)}%`, dir }
}

export function HomeWatchlistTicker() {
  const [tickers, setTickers] = useState<string[]>(() => getEffectiveWatchlistTickers(12))
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({})

  useEffect(() => subscribeMarketWatchlist((next) => setTickers(next.slice(0, 12))), [])

  useEffect(() => {
    let cancelled = false
    let timeoutId: number

    async function loadQuotes() {
      const symbols = tickers.slice(0, 12)
      if (symbols.length === 0) {
        if (!cancelled) setQuotes({})
        return
      }

      const next: Record<string, Quote | null> = {}
      try {
        const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`, {
          credentials: 'include',
        })
        if (!res.ok) {
          for (const t of symbols) next[t] = null
        } else {
          const data = (await res.json()) as { quotes?: Record<string, Quote> }
          const qmap = data.quotes ?? {}
          for (const t of symbols) {
            next[t] = qmap[t] ?? null
          }
        }
      } catch {
        for (const t of symbols) next[t] = null
      }

      if (!cancelled) setQuotes(next)
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
  }, [tickers])

  if (tickers.length === 0) {
    return (
      <div className="hwt hwt--empty" role="status">
        <span className="hwt__empty-text">Add stocks to your homepage market widget to see them here.</span>
      </div>
    )
  }

  const items = tickers.map((sym) => {
    const q = quotes[sym]
    const ch = formatChange(q)
    return (
      <span key={sym} className="hwt__item">
        <span className="hwt__sym">{sym}</span>
        <span className="hwt__price">{formatPrice(q?.price ?? null)}</span>
        {ch.text ? (
          <span className={`hwt__chg hwt__chg--${ch.dir}`}>{ch.text}</span>
        ) : (
          <span className="hwt__chg hwt__chg--flat">—</span>
        )}
      </span>
    )
  })

  const sep = <span className="hwt__sep" aria-hidden="true" />

  return (
    <div className="hwt" role="region" aria-label="Homepage stock watchlist">
      <div className="hwt__inner">
        <div className="hwt__track">
          <div className="hwt__strip">
            {items.map((el, i) => (
              <span key={`a-${i}`} className="hwt__cluster">
                {el}
                {sep}
              </span>
            ))}
          </div>
          <div className="hwt__strip" aria-hidden="true">
            {items.map((el, i) => (
              <span key={`b-${i}`} className="hwt__cluster">
                {el}
                {sep}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
