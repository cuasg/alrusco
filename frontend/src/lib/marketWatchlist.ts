/**
 * Homepage Market widget watchlist — shared with the US Commodities ticker via localStorage
 * and same-tab CustomEvent (storage events only fire across tabs).
 */

export const LS_MARKET_WATCHLIST = 'alrusco.market.watchlist.v1'

export const MARKET_WATCHLIST_CHANGE_EVENT = 'alrusco:market-watchlist-changed'

export const DEFAULT_MARKET_WATCHLIST: readonly string[] = ['SPY', 'QQQ']

/**
 * Raw parse: `null` if unset or invalid JSON; `[]` if user saved an empty list.
 */
export function readMarketWatchlistFromStorage(): string[] | null {
  try {
    const raw = localStorage.getItem(LS_MARKET_WATCHLIST)
    if (!raw) return null
    const p = JSON.parse(raw) as unknown
    if (!Array.isArray(p)) return null
    const t = p
      .filter((x) => typeof x === 'string')
      .map((x) => String(x).trim().toUpperCase())
      .filter(Boolean)
    return t.slice(0, 30)
  } catch {
    return null
  }
}

export function writeMarketWatchlistLocal(tickers: string[]) {
  const next = tickers.slice(0, 30)
  try {
    localStorage.setItem(LS_MARKET_WATCHLIST, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(MARKET_WATCHLIST_CHANGE_EVENT, { detail: { tickers: next } })
  )
}

/** Watchlist for UI when nothing is stored yet (matches MarketWidget initial state). */
export function getEffectiveWatchlistTickers(max = 12): string[] {
  const w = readMarketWatchlistFromStorage()
  if (w === null) return [...DEFAULT_MARKET_WATCHLIST].slice(0, max)
  return w.slice(0, max)
}

export function subscribeMarketWatchlist(onChange: (tickers: string[]) => void): () => void {
  const run = () => {
    onChange(getEffectiveWatchlistTickers(30))
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_MARKET_WATCHLIST || e.key === null) run()
  }
  const onCustom = () => run()

  window.addEventListener('storage', onStorage)
  window.addEventListener(MARKET_WATCHLIST_CHANGE_EVENT, onCustom)
  run()
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(MARKET_WATCHLIST_CHANGE_EVENT, onCustom)
  }
}
