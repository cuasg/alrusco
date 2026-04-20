export const SVG_ICONS = {
  gold: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3l3 6H2"/><path d="M13 3l-3 6h12"/><path d="M2 9l10 13L22 9"/></svg>`,
  silver: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10l4-4 4 4M8 14l4 4 4-4"/></svg>`,
  crudeoil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M6 12h12"/><path d="M6 7h12"/><path d="M6 17h12"/><path d="M4 22h16"/></svg>`,
  brentcrude: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M12 6v6l4 2"/><path d="M6 12h2M16 12h2M12 6v2M12 16v2"/></svg>`,
  naturalgas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c-2-2.67-4-4-4-6a4 4 0 0 1 8 0c0 2-2 3.33-4 6z"/><path d="M12 21a8 8 0 0 0 8-8c0-4-4-6-8-10-4 4-8 6-8 10a8 8 0 0 0 8 8z"/></svg>`,
  copper: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>`,
  aluminium: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M4 20V10l8-8 8 8v10"/><path d="M9 20v-6h6v6"/></svg>`,
  zinc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M12 22V12"/><path d="M3.3 7L12 12l8.7-5"/></svg>`,
  nickel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
  lead: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 18h12"/><path d="M6 14h12"/><path d="M10 6h4"/></svg>`,
  platinum: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
} as const

export type CommodityCategory = 'precious' | 'industrial' | 'energy'

export type CategoryFilter = CommodityCategory | 'all'

export type ConversionRow = {
  label: string
  unit?: string
  divisor: number
  decimals: number
  highlight?: boolean
}

export type CommodityDef = {
  name: string
  symbol: string
  icon: string
  category: CommodityCategory
  categoryLabel: string
  accentColor: string
  accentBg: string
  yahooSymbol: string | null
  intlUnit: string
  conversions: ConversionRow[]
  /**
   * Yahoo symbol for daily change/change% — COMEX lead (LED=F) often has no real movement in Yahoo data;
   * proxy tracks liquid base metals (DBB) so the pill is meaningful.
   */
  changeProxyYahooSymbol?: string
  /** Historical chart symbol when the primary quote is static or unsuitable for charts. */
  chartYahooSymbol?: string
}

export const COMMODITIES: Record<string, CommodityDef> = {
  gold: {
    name: 'Gold',
    symbol: 'GC=F',
    icon: SVG_ICONS.gold,
    category: 'precious',
    categoryLabel: 'Precious Metal',
    accentColor: 'hsl(45, 93%, 47%)',
    accentBg: 'hsl(45, 93%, 47%)',
    yahooSymbol: 'GC=F',
    intlUnit: 'Troy Oz',
    conversions: [
      { label: 'Per gram', unit: 'g', divisor: 31.1035, decimals: 2, highlight: true },
      { label: 'Per 10g', unit: '10g', divisor: 31.1035 / 10, decimals: 0 },
    ],
  },
  silver: {
    name: 'Silver',
    symbol: 'SI=F',
    icon: SVG_ICONS.silver,
    category: 'precious',
    categoryLabel: 'Precious Metal',
    accentColor: 'hsl(210, 10%, 62%)',
    accentBg: 'hsl(210, 10%, 62%)',
    yahooSymbol: 'SI=F',
    intlUnit: 'Troy Oz',
    conversions: [
      { label: 'Per gram', unit: 'g', divisor: 31.1035, decimals: 3, highlight: true },
      { label: 'Per 10g', unit: '10g', divisor: 31.1035 / 10, decimals: 2 },
    ],
  },
  platinum: {
    name: 'Platinum',
    symbol: 'PL=F',
    icon: SVG_ICONS.platinum,
    category: 'precious',
    categoryLabel: 'Precious Metal',
    accentColor: 'hsl(200, 8%, 65%)',
    accentBg: 'hsl(200, 8%, 65%)',
    yahooSymbol: 'PL=F',
    intlUnit: 'Troy Oz',
    conversions: [{ label: 'Per gram', unit: 'g', divisor: 31.1035, decimals: 2, highlight: true }],
  },
  crudeoil: {
    name: 'Crude Oil (WTI)',
    symbol: 'CL=F',
    icon: SVG_ICONS.crudeoil,
    category: 'energy',
    categoryLabel: 'Energy',
    accentColor: 'hsl(20, 80%, 45%)',
    accentBg: 'hsl(20, 80%, 45%)',
    yahooSymbol: 'CL=F',
    intlUnit: 'Barrel',
    conversions: [{ label: 'Per gallon (approx)', unit: 'gal', divisor: 42, decimals: 2, highlight: true }],
  },
  brentcrude: {
    name: 'Brent Crude',
    symbol: 'BZ=F',
    icon: SVG_ICONS.brentcrude,
    category: 'energy',
    categoryLabel: 'Energy',
    accentColor: 'hsl(30, 85%, 42%)',
    accentBg: 'hsl(30, 85%, 42%)',
    yahooSymbol: 'BZ=F',
    intlUnit: 'Barrel',
    conversions: [{ label: 'Per gallon (approx)', unit: 'gal', divisor: 42, decimals: 2, highlight: true }],
  },
  naturalgas: {
    name: 'Natural Gas',
    symbol: 'NG=F',
    icon: SVG_ICONS.naturalgas,
    category: 'energy',
    categoryLabel: 'Energy',
    accentColor: 'hsl(200, 70%, 50%)',
    accentBg: 'hsl(200, 70%, 50%)',
    yahooSymbol: 'NG=F',
    intlUnit: 'MMBtu',
    conversions: [{ label: 'Per therm (approx)', unit: 'therm', divisor: 10, decimals: 3, highlight: true }],
  },
  copper: {
    name: 'Copper',
    symbol: 'HG=F',
    icon: SVG_ICONS.copper,
    category: 'industrial',
    categoryLabel: 'Industrial Metal',
    accentColor: 'hsl(15, 75%, 50%)',
    accentBg: 'hsl(15, 75%, 50%)',
    yahooSymbol: 'HG=F',
    intlUnit: 'Pound',
    conversions: [{ label: 'Per kg', unit: 'kg', divisor: 0.453592, decimals: 2, highlight: true }],
  },
  aluminium: {
    name: 'Aluminium',
    symbol: 'ALI=F',
    icon: SVG_ICONS.aluminium,
    category: 'industrial',
    categoryLabel: 'Industrial Metal',
    accentColor: 'hsl(200, 15%, 55%)',
    accentBg: 'hsl(200, 15%, 55%)',
    yahooSymbol: 'ALI=F',
    intlUnit: 'Metric Ton',
    conversions: [{ label: 'Per kg', unit: 'kg', divisor: 1000, decimals: 2, highlight: true }],
  },
  zinc: {
    name: 'Zinc',
    symbol: 'ZN=F',
    icon: SVG_ICONS.zinc,
    category: 'industrial',
    categoryLabel: 'Industrial Metal',
    accentColor: 'hsl(180, 25%, 50%)',
    accentBg: 'hsl(180, 25%, 50%)',
    yahooSymbol: 'ZN=F',
    intlUnit: 'Pound',
    conversions: [{ label: 'Per kg', unit: 'kg', divisor: 0.453592, decimals: 2, highlight: true }],
  },
  nickel: {
    name: 'Nickel',
    symbol: 'JJN',
    icon: SVG_ICONS.nickel,
    category: 'industrial',
    categoryLabel: 'Industrial Metal',
    accentColor: 'hsl(150, 20%, 50%)',
    accentBg: 'hsl(150, 20%, 50%)',
    /** Bloomberg nickel subindex ETN (live Yahoo); not LME $/MT. */
    yahooSymbol: 'JJN',
    intlUnit: 'Share',
    conversions: [],
  },
  lead: {
    name: 'Lead',
    symbol: 'LED=F',
    icon: SVG_ICONS.lead,
    category: 'industrial',
    categoryLabel: 'Industrial Metal',
    accentColor: 'hsl(220, 15%, 45%)',
    accentBg: 'hsl(220, 15%, 45%)',
    /** COMEX lead — Yahoo often shows a static placeholder; price still comes from here. */
    yahooSymbol: 'LED=F',
    /** Invesco DB Base Metals ETF — liquid % change and chart vs stale LED=F series. */
    changeProxyYahooSymbol: 'DBB',
    chartYahooSymbol: 'DBB',
    intlUnit: 'Metric Ton',
    conversions: [{ label: 'Per kg', unit: 'kg', divisor: 1000, decimals: 2, highlight: true }],
  },
}

export type CommodityKey = keyof typeof COMMODITIES

export const COMMODITY_KEYS = Object.keys(COMMODITIES) as CommodityKey[]

/** Historical chart symbol (Yahoo). */
export function getChartSymbol(key: CommodityKey): string | null {
  const c = COMMODITIES[key]
  if (!c?.yahooSymbol) return null
  return c.chartYahooSymbol ?? c.yahooSymbol
}
