import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { COMMODITIES, COMMODITY_KEYS, type CommodityKey } from '../components/commodity/commodityConfig'
import { fetchAllPrices, type PriceData } from '../components/commodity/commodityApi'

/** Short labels for dense tile (same instruments as /us-commodities). */
const LABEL: Record<CommodityKey, string> = {
  gold: 'Gold',
  silver: 'Silver',
  platinum: 'Platinum',
  crudeoil: 'WTI',
  brentcrude: 'Brent',
  naturalgas: 'Nat gas',
  copper: 'Copper',
  aluminium: 'Al',
  zinc: 'Zinc',
  nickel: 'Ni (ETN)',
  lead: 'Lead',
}

function fmtUsd(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '—'
  return val.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

type Props = {
  /** Bump when parent Market tile "Refresh" is clicked to reload commodities too. */
  refreshNonce: number
  dock?: boolean
}

export function MarketWidgetCommodities({ refreshNonce, dock }: Props) {
  const [prices, setPrices] = useState<Partial<Record<CommodityKey, PriceData>>>({})
  const [loading, setLoading] = useState(true)
  const pricesRef = useRef(prices)
  pricesRef.current = prices

  const load = useCallback(async () => {
    const { prices: next } = await fetchAllPrices(pricesRef.current)
    setPrices(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [refreshNonce, load])

  useEffect(() => {
    const id = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(id)
  }, [load])

  const dockClass = dock ? ' market-widget__commodities--dock' : ''

  return (
    <div className={`market-widget__commodities${dockClass}`} role="group" aria-label="Commodity spot USD">
      <div className="market-commodity-head">
        <Link to="/us-commodities" className="market-commodity-head__link">
          Commodities
        </Link>
        <span className="market-commodity-head__meta hp-muted">
          {loading ? 'Loading…' : 'USD · /unit'}
        </span>
      </div>
      <div className="market-commodity-rows">
        {COMMODITY_KEYS.map((key) => {
          const cfg = COMMODITIES[key]
          const p = prices[key]
          const pct = p?.changePct
          const pctText = pct == null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
          const pctColor =
            pct == null ? undefined : pct > 0 ? 'var(--success-fg)' : pct < 0 ? 'var(--error-fg)' : undefined
          return (
            <div key={key} className="market-commodity-row">
              <span className="market-commodity-row__name" title={`${cfg.name} · ${cfg.intlUnit}`}>
                {LABEL[key]}
              </span>
              <span className="market-commodity-row__price">
                {fmtUsd(p?.price ?? null)}
                {p?.isApprox ? (
                  <span className="market-commodity-row__suffix" title="Approximate">
                    ~
                  </span>
                ) : null}
              </span>
              <span className="market-commodity-row__pct" style={{ color: pctColor }}>
                {pctText}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
