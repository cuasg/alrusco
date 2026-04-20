/* US Commodity Tracker (USD-focused)
   Adapted from upstream commodity-price-tracker (client-side, no backend). */

const SVG_ICONS = {
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
};

const COMMODITIES = {
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
    yahooSymbol: 'LED=F',
    changeProxyYahooSymbol: 'DBB',
    chartYahooSymbol: 'DBB',
    intlUnit: 'Metric Ton',
    conversions: [{ label: 'Per kg', unit: 'kg', divisor: 1000, decimals: 2, highlight: true }],
  },
};

let state = {
  prices: {},
  lastUpdate: null,
  isLoading: true,
  errors: {},
  activeCategory: 'all',
};

/** Same-origin API (Express proxies Yahoo / metals.live — avoids public CORS proxies: 403/429). */
const API_BASE = '/api/public/commodities';

async function fetchYahooChartJson(symbol, range, interval) {
  const url = `${API_BASE}/yahoo?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) return null;
  return resp.json();
}

function finiteMeta(v) {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function closeSeriesLength(quote) {
  const closes = quote && quote.close;
  if (!closes || !closes.length) return 0;
  return closes.filter((x) => x != null && Number.isFinite(x)).length;
}

async function fetchYahooChartForQuote(symbol) {
  const tryRanges = ['5d', '5y'];
  for (const range of tryRanges) {
    const data = await fetchYahooChartJson(symbol, range, '1d');
    if (!data) continue;
    const result = data.chart && data.chart.result && data.chart.result[0];
    if (!result || !result.meta) continue;
    if (range === '5d' && closeSeriesLength(result.indicators && result.indicators.quote && result.indicators.quote[0]) < 2) {
      continue;
    }
    const closes = result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close;
    const numericCloses = (closes || []).filter((x) => x != null && Number.isFinite(x));
    return { meta: result.meta, numericCloses };
  }
  return null;
}

async function fetchYahooQuote(symbol) {
  try {
    const loaded = await fetchYahooChartForQuote(symbol);
    if (!loaded) return null;
    const { meta, numericCloses } = loaded;
    let price = finiteMeta(meta.regularMarketPrice);
    let prevClose = finiteMeta(meta.chartPreviousClose) ?? finiteMeta(meta.previousClose);

    if (price == null && numericCloses.length > 0) {
      price = numericCloses[numericCloses.length - 1];
      if (numericCloses.length >= 2) {
        prevClose = prevClose ?? numericCloses[numericCloses.length - 2];
      }
    }

    if (price == null || !Number.isFinite(price)) return null;

    if (prevClose == null && numericCloses.length >= 2) {
      prevClose = numericCloses[numericCloses.length - 2];
    }

    const change = prevClose != null ? price - prevClose : 0;
    const changePct = prevClose != null && prevClose !== 0 ? (change / prevClose) * 100 : 0;
    return { price, change, changePct };
  } catch {
    return null;
  }
}

async function fetchYahooQuoteWithChangeProxy(priceSymbol, proxySymbol) {
  const [main, proxy] = await Promise.all([fetchYahooQuote(priceSymbol), fetchYahooQuote(proxySymbol)]);
  if (!main) return null;
  if (!proxy) return main;
  return {
    ...main,
    change: proxy.change,
    changePct: proxy.changePct,
    changeIsProxy: true,
  };
}

async function fetchAllPrices() {
  const keys = Object.keys(COMMODITIES);
  const promises = keys.map(async (key) => {
    const cfg = COMMODITIES[key];
    if (!cfg.yahooSymbol) return [key, null];
    if (cfg.changeProxyYahooSymbol) {
      return [key, await fetchYahooQuoteWithChangeProxy(cfg.yahooSymbol, cfg.changeProxyYahooSymbol)];
    }
    return [key, await fetchYahooQuote(cfg.yahooSymbol)];
  });
  const results = await Promise.allSettled(promises);

  for (let i = 0; i < keys.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value) {
      const [key, data] = r.value;
      if (data) {
        state.prices[key] = data;
        delete state.errors[key];
      } else if (!state.prices[key]) {
        state.errors[key] = 'No data';
      }
    }
  }

  state.lastUpdate = new Date();
  state.isLoading = false;
}

function fmtUSD(val, decimals = 2) {
  if (val == null || Number.isNaN(val)) return '—';
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtChange(change, changePct) {
  if (change == null) return { text: '—', cls: 'neutral' };
  const sign = change >= 0 ? '+' : '';
  const cls = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  return { text: `${sign}${change.toFixed(2)} · ${sign}${changePct.toFixed(2)}%`, cls };
}

function fmtTime(date) {
  if (!date) return '—';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getCategoryStyle(category) {
  switch (category) {
    case 'precious':
      return 'background:hsl(45 93% 47% / 0.1);color:hsl(45,80%,40%);border:1px solid hsl(45 93% 47% / 0.2)';
    case 'industrial':
      return 'background:hsl(200 50% 50% / 0.1);color:hsl(200,50%,40%);border:1px solid hsl(200 50% 50% / 0.2)';
    case 'energy':
      return 'background:hsl(0 60% 50% / 0.1);color:hsl(0,60%,45%);border:1px solid hsl(0 60% 50% / 0.2)';
    default:
      return 'background:var(--l3);color:var(--t3);border:1px solid var(--sep2)';
  }
}

function buildRefRows(key) {
  const config = COMMODITIES[key];
  const priceData = state.prices[key];
  if (!priceData) {
    return `<div class="price-row"><span class="price-label">Loading…</span><span class="price-value">—</span></div>`;
  }

  let rows = `
    <div class="price-row">
      <span class="price-label">Per ${config.intlUnit.toLowerCase()}</span>
      <span class="price-value highlight">${fmtUSD(priceData.price)}</span>
    </div>
  `;

  if (config.conversions) {
    for (const c of config.conversions) {
      const val = priceData.price / c.divisor;
      rows += `
        <div class="price-row">
          <span class="price-label">${c.label}</span>
          <span class="price-value${c.highlight ? ' highlight' : ''}">${fmtUSD(val, c.decimals)}${c.unit ? `/${c.unit}` : ''}</span>
        </div>
      `;
    }
  }

  return rows;
}

function buildCommodityCard(key) {
  const config = COMMODITIES[key];
  const priceData = state.prices[key];
  const isApprox = priceData?.isApprox || false;
  const isLME = priceData?.isLME || false;
  const change = priceData ? fmtChange(priceData.change, priceData.changePct) : fmtChange(null);
  const intlPriceStr = priceData ? fmtUSD(priceData.price) : '—';
  const proxyTitleAttr =
    priceData && priceData.changeIsProxy && config.changeProxyYahooSymbol
      ? ` title="Daily change from ${config.changeProxyYahooSymbol} (ETF). Spot from ${config.yahooSymbol}."`
      : '';
  const approxBadge = isApprox
    ? ' <span style="font-size:9px;color:var(--orange);font-family:var(--font-body);font-weight:600;vertical-align:super">~APPROX</span>'
    : isLME
      ? ' <span style="font-size:9px;color:var(--teal);font-family:var(--font-body);font-weight:600;vertical-align:super">LME</span>'
      : '';

  return `
    <div class="commodity-card" data-commodity="${key}" data-category="${config.category}" style="--commodity-accent:${config.accentColor}">
      <div class="commodity-card-inner">
        <div class="commodity-header">
          <div style="display:flex;align-items:center">
            <div class="commodity-icon" style="background:linear-gradient(135deg, ${config.accentBg}, ${config.accentColor})">${config.icon}</div>
            <div class="commodity-info">
              <div class="commodity-name">${config.name}</div>
              <div class="commodity-symbol">${config.symbol}</div>
            </div>
          </div>
          <span class="commodity-category-badge" style="${getCategoryStyle(config.category)}">${config.categoryLabel}</span>
        </div>

        <div class="intl-price-row">
          <div>
            <div class="intl-price" id="intl-${key}">${intlPriceStr}${approxBadge}</div>
            <div class="intl-unit">/ ${config.intlUnit.toLowerCase()}</div>
          </div>
          <div class="intl-change">
            <span class="change-pill ${change.cls}" id="change-${key}"${proxyTitleAttr}>${change.text}</span>
          </div>
        </div>

        <div class="ref-panel">
          <div class="ref-panel-header">
            <span class="ref-panel-title">USD reference · unit conversions</span>
            ${config.yahooSymbol ? `<button class="chart-btn" onclick="event.stopPropagation();openChart('${key}')">${SVG_ICONS.chart} Chart</button>` : ''}
          </div>
          <div id="ref-${key}">
            ${buildRefRows(key)}
          </div>
        </div>
      </div>

      <div class="data-source">
        <span>Source: ${
          isLME
            ? 'metals.live (LME)'
            : isApprox
              ? 'LME Approx'
              : priceData && priceData.changeIsProxy && config.changeProxyYahooSymbol
                ? 'Yahoo Finance · spot ' + config.yahooSymbol + ' · daily Δ% ' + config.changeProxyYahooSymbol
                : 'Yahoo Finance (' + (config.yahooSymbol || 'N/A') + ')'
        }</span>
        <span id="tick-${key}">${state.lastUpdate ? fmtTime(state.lastUpdate) : '—'}</span>
      </div>
    </div>
  `;
}

function renderAllCards() {
  const grid = document.getElementById('commodity-grid');
  const keys = Object.keys(COMMODITIES).filter((key) => {
    if (state.activeCategory === 'all') return true;
    return COMMODITIES[key].category === state.activeCategory;
  });
  grid.innerHTML = keys.map((k) => buildCommodityCard(k)).join('');
}

function updateCards() {
  Object.keys(COMMODITIES).forEach((key) => {
    const config = COMMODITIES[key];
    const priceData = state.prices[key];
    if (!priceData) return;

    const intlEl = document.getElementById(`intl-${key}`);
    if (intlEl) intlEl.textContent = fmtUSD(priceData.price);

    const changeEl = document.getElementById(`change-${key}`);
    if (changeEl) {
      const c = fmtChange(priceData.change, priceData.changePct);
      changeEl.textContent = c.text;
      changeEl.className = `change-pill ${c.cls}`;
      if (priceData.changeIsProxy && config.changeProxyYahooSymbol) {
        changeEl.title = `Daily change from ${config.changeProxyYahooSymbol} (ETF). Spot from ${config.yahooSymbol}.`;
      } else {
        changeEl.removeAttribute('title');
      }
    }

    const refEl = document.getElementById(`ref-${key}`);
    if (refEl) refEl.innerHTML = buildRefRows(key);

    const tickTimeEl = document.getElementById(`tick-${key}`);
    if (tickTimeEl && state.lastUpdate) tickTimeEl.textContent = fmtTime(state.lastUpdate);
  });

  updateStatus();
}

function updateStatus() {
  const pill = document.getElementById('status-pill');
  const text = document.getElementById('status-text');
  if (!pill || !text) return;

  const hasAnyData = Object.keys(state.prices).length > 0;
  const errCount = Object.keys(state.errors).length;

  if (hasAnyData && errCount === 0) {
    pill.className = 'status-pill';
    text.textContent = 'LIVE';
  } else if (hasAnyData) {
    pill.className = 'status-pill err';
    text.textContent = `PARTIAL (${errCount} ERR)`;
  } else if (state.isLoading) {
    pill.className = 'status-pill err';
    text.textContent = 'LOADING';
  } else {
    pill.className = 'status-pill err';
    text.textContent = 'OFFLINE';
  }
}

function filterCategory(cat) {
  state.activeCategory = cat;
  document.querySelectorAll('.cat-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.cat === cat);
  });
  renderAllCards();
}
window.filterCategory = filterCategory;

const refreshSvg = `<span style="display:inline-flex;width:14px;height:14px">${SVG_ICONS.refresh}</span>`;
async function forceRefresh() {
  const btn = document.getElementById('refresh-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `${refreshSvg} Loading...`;
  }
  await fetchAllPrices();
  updateCards();
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `${refreshSvg} Refresh`;
  }
}
window.forceRefresh = forceRefresh;

async function init() {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('cat');
  if (cat && ['precious', 'industrial', 'energy', 'all'].includes(cat)) {
    filterCategory(cat);
  } else {
    renderAllCards();
  }

  await fetchAllPrices();
  renderAllCards();
  updateCards();

  setInterval(async () => {
    await fetchAllPrices();
    updateCards();
  }, 10000);
}

document.addEventListener('DOMContentLoaded', init);

// ── Charts (Lightweight Charts via Yahoo historical data) ──
let chartInstance = null;
let chartSeries = null;
let currentChartKey = null;
let currentRange = '1y';

function getChartSymbol(key) {
  const c = COMMODITIES[key];
  if (!c || !c.yahooSymbol) return null;
  return c.chartYahooSymbol || c.yahooSymbol;
}

function rangeToCutoffUnix(range) {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  switch (range) {
    case '1mo':
      return now - 30 * day;
    case '3mo':
      return now - 90 * day;
    case '6mo':
      return now - 180 * day;
    case '1y':
      return now - 365 * day;
    case '2y':
      return now - 730 * day;
    case '5y':
      return now - 1825 * day;
    case '10y':
      return now - 3650 * day;
    case 'max':
      return null;
    default:
      return now - 365 * day;
  }
}

function ohlcBarsFromAdjclose(result) {
  const timestamps = result.timestamp;
  const adj = result.indicators && result.indicators.adjclose && result.indicators.adjclose[0] && result.indicators.adjclose[0].adjclose;
  if (!timestamps || !timestamps.length || !adj || !adj.length) return [];
  let lastClose = undefined;
  const ohlcData = [];
  for (let i = 0; i < timestamps.length; i++) {
    const raw = adj[i];
    if (raw != null && Number.isFinite(raw)) {
      lastClose = raw;
    }
    if (lastClose == null) continue;
    const c = raw != null && Number.isFinite(raw) ? raw : lastClose;
    const v = +Number(c).toFixed(2);
    ohlcData.push({ time: timestamps[i], open: v, high: v, low: v, close: v });
  }
  return ohlcData;
}

function ohlcBarsFromChartResult(result) {
  const timestamps = result.timestamp;
  if (!timestamps || !timestamps.length) return [];
  const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
  if (!quote) {
    return ohlcBarsFromAdjclose(result);
  }
  let lastClose = undefined;
  const ohlcData = [];
  for (let i = 0; i < timestamps.length; i++) {
    const raw = quote.close && quote.close[i];
    if (raw != null && Number.isFinite(raw)) {
      lastClose = raw;
    }
    if (lastClose == null) continue;
    const c = raw != null && Number.isFinite(raw) ? raw : lastClose;
    const o = quote.open && quote.open[i] != null ? quote.open[i] : c;
    const h = quote.high && quote.high[i] != null ? quote.high[i] : c;
    const l = quote.low && quote.low[i] != null ? quote.low[i] : c;
    ohlcData.push({
      time: timestamps[i],
      open: +Number(o).toFixed(2),
      high: +Number(h).toFixed(2),
      low: +Number(l).toFixed(2),
      close: +Number(c).toFixed(2),
    });
  }
  if (ohlcData.length === 0) {
    return ohlcBarsFromAdjclose(result);
  }
  return ohlcData;
}

const CHART_WIDE_RANGES = ['5y', 'max', '10y'];

function chartSeriesLooksStale(bars) {
  if (!bars || bars.length === 0) return true;
  const lastT = bars[bars.length - 1].time;
  const maxAgeSec = 120 * 86400;
  return lastT < Math.floor(Date.now() / 1000) - maxAgeSec;
}

function applyRangeWindow(bars, range) {
  const cutoff = rangeToCutoffUnix(range);
  if (cutoff == null) return bars;
  const filtered = bars.filter((b) => b.time >= cutoff);
  return filtered.length >= 2 ? filtered : bars;
}

async function fetchHistoricalData(symbol, range) {
  const interval = '1d';
  try {
    const data = await fetchYahooChartJson(symbol, range, interval);
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    let ohlcData = result ? ohlcBarsFromChartResult(result) : [];

    const needWide = ohlcData.length < 2 || chartSeriesLooksStale(ohlcData);

    if (needWide) {
      let merged = [];
      for (const wr of CHART_WIDE_RANGES) {
        const wide = await fetchYahooChartJson(symbol, wr, '1d');
        if (!wide) continue;
        const wr0 = wide.chart && wide.chart.result && wide.chart.result[0];
        if (!wr0) continue;
        const wideBars = ohlcBarsFromChartResult(wr0);
        if (wideBars.length < 2) continue;
        merged = applyRangeWindow(wideBars, range);
        if (merged.length >= 2) break;
        merged = wideBars;
        break;
      }
      if (merged.length >= 2) {
        ohlcData = merged;
      }
    }

    return ohlcData.length ? ohlcData : null;
  } catch {
    return null;
  }
}

function isUniformOhlc(data) {
  if (data.length < 2) return false;
  const b = data[0];
  return data.every((d) => d.open === b.open && d.high === b.high && d.low === b.low && d.close === b.close);
}

function getChartThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark
    ? {
        bg: '#0a0f1c',
        text: '#8a9ab5',
        grid: 'rgba(40,48,64,0.3)',
        border: 'rgba(40,48,64,0.5)',
        upColor: '#30b86a',
        downColor: '#d94848',
        wickUp: '#30b86a',
        wickDown: '#d94848',
        crosshairColor: 'rgba(232,128,64,0.4)',
      }
    : {
        bg: '#ffffff',
        text: '#6b6158',
        grid: 'rgba(226,223,219,0.5)',
        border: 'rgba(226,223,219,0.8)',
        upColor: '#25a05a',
        downColor: '#d93636',
        wickUp: '#25a05a',
        wickDown: '#d93636',
        crosshairColor: 'rgba(240,112,32,0.4)',
      };
}

async function openChart(key) {
  currentChartKey = key;
  currentRange = '1y';
  const config = COMMODITIES[key];

  document.getElementById('chart-title').textContent = `${config.name} — Historical`;
  document.getElementById('chart-sub').textContent = `${getChartSymbol(key) || key.toUpperCase()} · Yahoo Finance`;
  const hintEl = document.getElementById('chart-hint');
  if (hintEl) {
    if (config.yahooSymbol && getChartSymbol(key) !== config.yahooSymbol) {
      hintEl.textContent = `Spot on card: ${config.yahooSymbol}`;
      hintEl.style.display = 'block';
    } else {
      hintEl.textContent = '';
      hintEl.style.display = 'none';
    }
  }

  document.querySelectorAll('.tf-btn').forEach((b) => b.classList.remove('active'));
  document.querySelector('.tf-btn[data-range="1y"]').classList.add('active');

  document.getElementById('chart-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  await renderChart(key, '1y');
}
window.openChart = openChart;

async function renderChart(key, range) {
  const container = document.getElementById('chart-container');
  container.innerHTML = '<div class="chart-loading">Loading chart data...</div>';

  if (chartInstance) {
    chartInstance.remove();
    chartInstance = null;
  }

  const symbol = getChartSymbol(key);
  if (!symbol) {
    container.innerHTML = '<div class="chart-loading">Chart not available</div>';
    return;
  }

  let data;
  try {
    data = await fetchHistoricalData(symbol, range);
  } catch {
    container.innerHTML = '<div class="chart-loading">Unable to load chart data</div>';
    return;
  }
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="chart-loading">Unable to load chart data</div>';
    return;
  }

  container.innerHTML = '';
  const colors = getChartThemeColors();

  try {
    chartInstance = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: 'solid', color: colors.bg },
        textColor: colors.text,
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
        fontSize: 12,
      },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      crosshair: {
        mode: 0,
        vertLine: { color: colors.crosshairColor, width: 1, style: 2 },
        horzLine: { color: colors.crosshairColor, width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: colors.border, timeVisible: false },
      handleScroll: true,
      handleScale: true,
    });

    const useLine = isUniformOhlc(data);
    if (useLine) {
      chartSeries = chartInstance.addLineSeries({
        color: colors.upColor,
        lineWidth: 2,
      });
      chartSeries.setData(data.map((d) => ({ time: d.time, value: d.close })));
    } else {
      chartSeries = chartInstance.addCandlestickSeries({
        upColor: colors.upColor,
        downColor: colors.downColor,
        borderDownColor: colors.downColor,
        borderUpColor: colors.upColor,
        wickDownColor: colors.wickDown,
        wickUpColor: colors.wickUp,
      });
      chartSeries.setData(data);
    }

    chartInstance.timeScale().fitContent();

    const first = new Date(data[0].time * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const last = new Date(data[data.length - 1].time * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const unit = useLine ? 'points' : 'candles';
    const rangeLabel = document.getElementById('chart-data-range');
    if (rangeLabel) rangeLabel.textContent = `${first} — ${last} · ${data.length} ${unit}`;
  } catch {
    if (chartInstance) {
      chartInstance.remove();
      chartInstance = null;
    }
    container.innerHTML = '<div class="chart-loading">Unable to render chart</div>';
    return;
  }

  const resizeObserver = new ResizeObserver(() => {
    if (chartInstance) chartInstance.applyOptions({ width: container.clientWidth, height: container.clientHeight });
  });
  resizeObserver.observe(container);
}

async function changeRange(range) {
  currentRange = range;
  document.querySelectorAll('.tf-btn').forEach((b) => b.classList.remove('active'));
  document.querySelector(`.tf-btn[data-range="${range}"]`).classList.add('active');
  if (currentChartKey) await renderChart(currentChartKey, range);
}
window.changeRange = changeRange;

function closeChart() {
  document.getElementById('chart-modal').style.display = 'none';
  document.body.style.overflow = '';
  if (chartInstance) {
    chartInstance.remove();
    chartInstance = null;
  }
}
window.closeChart = closeChart;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeChart();
});

