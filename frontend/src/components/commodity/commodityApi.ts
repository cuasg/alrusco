import type { CommodityKey } from './commodityConfig'
import { COMMODITIES } from './commodityConfig'

const API_BASE = '/api/public/commodities'

export type PriceData = {
  price: number
  change: number
  changePct: number
  isLME?: boolean
  isApprox?: boolean
  /** Set when daily change/% are taken from `changeProxyYahooSymbol` (e.g. DBB for lead). */
  changeIsProxy?: boolean
}

export async function fetchYahooChartJson(
  symbol: string,
  range: string,
  interval: string
): Promise<unknown | null> {
  const url = `${API_BASE}/yahoo?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`
  const resp = await fetch(url, { credentials: 'same-origin' })
  if (!resp.ok) return null
  return resp.json()
}

/**
 * Spot/last price from Yahoo chart API. Uses 5d range so thin futures (e.g. LED=F) still have
 * bar closes when regularMarketPrice is missing.
 */
/** Yahoo meta fields are usually numbers; coerce so we never treat string/NaN as valid price. */
function finiteMeta(v: unknown): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function closeSeriesLength(
  quote: Record<string, (number | null)[] | undefined> | undefined
): number {
  const closes = quote?.close
  if (!closes?.length) return 0
  return closes.filter((x): x is number => x != null && Number.isFinite(x)).length
}

/**
 * Yahoo sometimes returns empty `indicators.quote` for short ranges on thin symbols (e.g. JJN).
 * A wider range (5y/1d) restores daily closes so we can show price and day-over-day change.
 */
async function fetchYahooChartForQuote(symbol: string): Promise<{
  meta: Record<string, number | undefined>
  numericCloses: number[]
} | null> {
  const tryRanges = ['5d', '5y'] as const
  for (const range of tryRanges) {
    const data = await fetchYahooChartJson(symbol, range, '1d')
    if (!data) continue
    const chart = data as {
      chart?: {
        result?: Array<{
          meta?: Record<string, number | undefined>
          indicators?: { quote?: Array<Record<string, (number | null)[] | undefined>> }
        }>
        error?: unknown
      }
    }
    const result = chart?.chart?.result?.[0]
    if (!result?.meta) continue
    const closes = result.indicators?.quote?.[0]?.close
    const numericCloses =
      closes?.filter((x): x is number => x != null && Number.isFinite(x)) ?? []
    if (range === '5d' && closeSeriesLength(result.indicators?.quote?.[0]) < 2) {
      continue
    }
    return { meta: result.meta, numericCloses }
  }
  return null
}

/**
 * Spot price from `priceSymbol`, day change from `proxySymbol` (Yahoo has no reliable change for some contracts).
 */
export async function fetchYahooQuoteWithChangeProxy(
  priceSymbol: string,
  proxySymbol: string
): Promise<PriceData | null> {
  const [main, proxy] = await Promise.all([fetchYahooQuote(priceSymbol), fetchYahooQuote(proxySymbol)])
  if (!main) return null
  if (!proxy) return main
  return {
    ...main,
    change: proxy.change,
    changePct: proxy.changePct,
    changeIsProxy: true,
  }
}

export async function fetchYahooQuote(symbol: string): Promise<PriceData | null> {
  try {
    const loaded = await fetchYahooChartForQuote(symbol)
    if (!loaded) return null

    const { meta, numericCloses } = loaded
    let price: number | undefined = finiteMeta(meta.regularMarketPrice)
    let prevClose: number | undefined = finiteMeta(meta.chartPreviousClose) ?? finiteMeta(meta.previousClose)

    if (price == null && numericCloses.length > 0) {
      price = numericCloses[numericCloses.length - 1]
      if (numericCloses.length >= 2) {
        prevClose = prevClose ?? numericCloses[numericCloses.length - 2]
      }
    }

    if (price == null || !Number.isFinite(price)) return null

    if (prevClose == null && numericCloses.length >= 2) {
      prevClose = numericCloses[numericCloses.length - 2]
    }

    const change = prevClose != null ? price - prevClose : 0
    const changePct = prevClose != null && prevClose !== 0 ? (change / prevClose) * 100 : 0
    return { price, change, changePct }
  } catch {
    return null
  }
}

export type FetchPricesResult = {
  prices: Partial<Record<CommodityKey, PriceData>>
  errors: Partial<Record<CommodityKey, string>>
}

export async function fetchAllPrices(
  previous: Partial<Record<CommodityKey, PriceData>> = {}
): Promise<FetchPricesResult> {
  const keys = Object.keys(COMMODITIES) as CommodityKey[]
  const promises = keys.map(async (key) => {
    const cfg = COMMODITIES[key]
    if (!cfg.yahooSymbol) return [key, null] as const
    if (cfg.changeProxyYahooSymbol) {
      return [key, await fetchYahooQuoteWithChangeProxy(cfg.yahooSymbol, cfg.changeProxyYahooSymbol)] as const
    }
    return [key, await fetchYahooQuote(cfg.yahooSymbol)] as const
  })
  const results = await Promise.allSettled(promises)
  const prices: Partial<Record<CommodityKey, PriceData>> = { ...previous }
  const errors: Partial<Record<CommodityKey, string>> = {}

  for (let i = 0; i < keys.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled' && r.value) {
      const [key, data] = r.value as [CommodityKey, PriceData | null]
      if (data) {
        prices[key] = data
        delete errors[key]
      } else if (!prices[key]) {
        errors[key] = 'No data'
      }
    }
  }

  return { prices, errors }
}

export type OhlcBar = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

/** Lower bound (unix) for the selected window, or `null` for full series (max). */
function rangeToCutoffUnix(range: string): number | null {
  const now = Math.floor(Date.now() / 1000)
  const day = 86400
  switch (range) {
    case '1mo':
      return now - 30 * day
    case '3mo':
      return now - 90 * day
    case '6mo':
      return now - 180 * day
    case '1y':
      return now - 365 * day
    case '2y':
      return now - 730 * day
    case '5y':
      return now - 1825 * day
    case '10y':
      return now - 3650 * day
    case 'max':
      return null
    default:
      return now - 365 * day
  }
}

type YahooChartResult = {
  timestamp?: number[]
  indicators?: {
    quote?: Array<Record<string, (number | null)[] | undefined>>
    adjclose?: Array<{ adjclose?: (number | null)[] }>
  }
}

function ohlcBarsFromAdjclose(result: YahooChartResult): OhlcBar[] {
  const timestamps = result.timestamp
  const adj = result.indicators?.adjclose?.[0]?.adjclose
  if (!timestamps?.length || !adj?.length) return []

  let lastClose: number | undefined
  const ohlcData: OhlcBar[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const raw = adj[i]
    if (raw != null && Number.isFinite(raw)) {
      lastClose = raw
    }
    if (lastClose == null) continue

    const c = raw != null && Number.isFinite(raw) ? raw : lastClose
    const v = +Number(c).toFixed(2)
    ohlcData.push({
      time: timestamps[i],
      open: v,
      high: v,
      low: v,
      close: v,
    })
  }
  return ohlcData
}

function ohlcBarsFromChartResult(result: YahooChartResult): OhlcBar[] {
  const timestamps = result.timestamp
  if (!timestamps?.length) return []

  const quote = result.indicators?.quote?.[0]
  if (!quote) {
    return ohlcBarsFromAdjclose(result)
  }

  /** ETNs / thin symbols (e.g. JJN): Yahoo often keeps daily timestamps but nulls OHLC for years — carry last settlement. */
  let lastClose: number | undefined

  const ohlcData: OhlcBar[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const raw = quote.close?.[i]
    if (raw != null && Number.isFinite(raw)) {
      lastClose = raw
    }
    if (lastClose == null) continue

    const c = raw != null && Number.isFinite(raw) ? raw : lastClose
    const o = quote.open?.[i] ?? c
    const h = quote.high?.[i] ?? c
    const l = quote.low?.[i] ?? c
    ohlcData.push({
      time: timestamps[i],
      open: +Number(o).toFixed(2),
      high: +Number(h).toFixed(2),
      low: +Number(l).toFixed(2),
      close: +Number(c).toFixed(2),
    })
  }

  if (ohlcData.length === 0) {
    return ohlcBarsFromAdjclose(result)
  }
  return ohlcData
}

const CHART_WIDE_RANGES = ['5y', 'max', '10y'] as const

function chartSeriesLooksStale(bars: OhlcBar[]): boolean {
  if (bars.length === 0) return true
  const lastT = bars[bars.length - 1].time
  const maxAgeSec = 120 * 86400
  return lastT < Math.floor(Date.now() / 1000) - maxAgeSec
}

function applyRangeWindow(bars: OhlcBar[], range: string): OhlcBar[] {
  const cutoff = rangeToCutoffUnix(range)
  if (cutoff == null) return bars
  const filtered = bars.filter((b) => b.time >= cutoff)
  return filtered.length >= 2 ? filtered : bars
}

export async function fetchHistoricalData(symbol: string, range: string): Promise<OhlcBar[] | null> {
  /** Daily bars for all windows — weekly misses thin-symbol fixes; see JJN. */
  const interval = '1d'
  try {
    type YahooChartPayload = {
      chart?: {
        result?: YahooChartResult[]
        error?: unknown
      }
    }

    /** Primary range can fail (network) or return meta-only for thin symbols (e.g. JJN has no `timestamp` for 1mo–6mo). Never bail before wide-range fallback. */
    const data = await fetchYahooChartJson(symbol, range, interval)
    const parsed = data as YahooChartPayload | null
    const result = parsed?.chart?.result?.[0]
    let ohlcData = data && result ? ohlcBarsFromChartResult(result) : []

    const needWide =
      ohlcData.length < 2 || chartSeriesLooksStale(ohlcData)

    if (needWide) {
      let merged: OhlcBar[] = []
      for (const wr of CHART_WIDE_RANGES) {
        const wide = await fetchYahooChartJson(symbol, wr, '1d')
        if (!wide) continue
        const w = wide as YahooChartPayload
        const wr0 = w?.chart?.result?.[0]
        if (!wr0) continue
        const wideBars = ohlcBarsFromChartResult(wr0)
        if (wideBars.length < 2) continue
        merged = applyRangeWindow(wideBars, range)
        if (merged.length >= 2) break
        merged = wideBars
        break
      }
      if (merged.length >= 2) {
        ohlcData = merged
      }
    }

    return ohlcData.length ? ohlcData : null
  } catch {
    return null
  }
}
