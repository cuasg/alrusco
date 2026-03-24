import { useCallback, useEffect, useId, useRef, useState } from 'react'

type WeatherData = {
  temperature: number
  description: string
  icon: string | null
  weekday: string
  locationLabel: string | null
}

type ForecastHour = {
  dt: number
  timeLabel: string
  temp: number
  windDeg: number
  windSpeed: number
  description: string
  iconCode: string
  main: string
  pop: number
  precipInPerHr: number | null
}

type ForecastDay = {
  date: string
  weekdayShort: string
  high: number
  low: number
  description: string
  iconCode: string
  main: string
  hours: ForecastHour[]
}

type ForecastData = {
  days: ForecastDay[]
  locationLabel: string | null
}

function openWeatherIconUrl(iconCode: string, size: '1x' | '2x' = '2x'): string {
  const suffix = size === '2x' ? '@2x' : ''
  return `https://openweathermap.org/img/wn/${iconCode}${suffix}.png`
}

function weatherUrl(path: string, coords: { lat: number; lon: number } | null): string {
  if (!coords) return path
  const q = new URLSearchParams()
  q.set('lat', String(coords.lat))
  q.set('lon', String(coords.lon))
  return `${path}?${q.toString()}`
}

function shouldShowPrecipitation(h: ForecastHour): boolean {
  const m = h.main
  if (/^(Rain|Drizzle|Thunderstorm|Snow)$/i.test(m)) return true
  if (h.pop >= 0.05) return true
  if (h.precipInPerHr != null && h.precipInPerHr >= 0.0005) return true
  return false
}

function formatPrecipInPerHr(inPerHr: number): string {
  if (inPerHr < 0.005) return '<0.01'
  return inPerHr.toFixed(2)
}

function windDegToCompass(deg: number): string {
  const d = ((deg % 360) + 360) % 360
  const names = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]
  const idx = Math.round(d / 22.5) % 16
  return names[idx] ?? 'N'
}

export function WeatherBadge() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [expandedDayDate, setExpandedDayDate] = useState<string | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const fetchWeather = useCallback(async () => {
    try {
      const url = weatherUrl('/api/weather', coordsRef.current)
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error('Weather unavailable')
      }
      const data = (await res.json()) as WeatherData
      setWeather(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Weather unavailable')
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function runFetch() {
      if (cancelled) return
      await fetchWeather()
    }

    function requestWithGeolocation() {
      if (!('geolocation' in navigator)) {
        void runFetch()
        return
      }

      let resolved = false

      const fallbackTimeout = window.setTimeout(() => {
        if (!resolved) {
          resolved = true
          void runFetch()
        }
      }, 5000)

      navigator.geolocation.getCurrentPosition(
        position => {
          if (resolved) return
          resolved = true
          window.clearTimeout(fallbackTimeout)

          coordsRef.current = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          }

          void runFetch()
        },
        () => {
          if (resolved) return
          resolved = true
          window.clearTimeout(fallbackTimeout)
          void runFetch()
        },
        {
          enableHighAccuracy: false,
          maximumAge: 10 * 60 * 1000,
          timeout: 4000,
        },
      )
    }

    requestWithGeolocation()
    const id = window.setInterval(() => {
      void runFetch()
    }, 15 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [fetchWeather])

  const loadForecast = useCallback(async () => {
    setForecastLoading(true)
    setForecastError(null)
    try {
      const url = weatherUrl('/api/weather/forecast', coordsRef.current)
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error('Forecast unavailable')
      }
      const data = (await res.json()) as ForecastData
      const days = Array.isArray(data.days)
        ? data.days.map(d => ({
            ...d,
            hours: Array.isArray(d.hours)
              ? d.hours.map(h => ({
                  ...h,
                  pop: typeof h.pop === 'number' && Number.isFinite(h.pop) ? h.pop : 0,
                  precipInPerHr:
                    typeof h.precipInPerHr === 'number' && Number.isFinite(h.precipInPerHr)
                      ? h.precipInPerHr
                      : null,
                }))
              : [],
          }))
        : []
      setForecast({ ...data, days })
    } catch (e) {
      setForecastError(e instanceof Error ? e.message : 'Forecast unavailable')
    } finally {
      setForecastLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!expanded) {
      setForecastError(null)
      setExpandedDayDate(null)
      return
    }

    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current
      if (!el || !(e.target instanceof Node)) return
      if (!el.contains(e.target)) {
        setExpanded(false)
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setExpanded(false)
      }
    }

    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    if (forecast != null || forecastLoading) return
    if (forecastError != null) return
    void loadForecast()
  }, [expanded, forecast, forecastLoading, forecastError, loadForecast])

  function toggleDayHourly(date: string) {
    setExpandedDayDate(prev => (prev === date ? null : date))
  }

  if (error || !weather) {
    return (
      <div
        className="weather-badge weather-badge--muted"
        aria-label="Weather unavailable"
        title="Weather unavailable"
      >
        <span>Weather —</span>
      </div>
    )
  }

  const tooltip =
    weather.locationLabel != null && weather.locationLabel.trim()
      ? `Weather — ${weather.locationLabel}. Click for forecast and hourly details.`
      : `Weather — ${weather.description}. Click for forecast and hourly details.`

  return (
    <div
      ref={wrapRef}
      className="weather-widget"
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        type="button"
        className="weather-badge weather-expand-trigger"
        aria-label={`Weather ${weather.description}`}
        aria-expanded={expanded}
        aria-controls={panelId}
        title={tooltip}
        onClick={e => {
          e.stopPropagation()
          setExpanded(prev => !prev)
        }}
      >
        <span className="weather-day">{weather.weekday}</span>
        {weather.icon && <span className="weather-icon">{weather.icon}</span>}
        <span className="weather-temp">{Math.round(weather.temperature)}°F</span>
      </button>

      {expanded && (
        <div
          id={panelId}
          className="weather-forecast-panel"
          role="region"
          aria-label="Five-day forecast"
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="weather-forecast-header">
            <h3 className="weather-forecast-title">5-day forecast</h3>
            {(forecast?.locationLabel ?? weather.locationLabel) && (
              <p className="weather-forecast-location">
                {forecast?.locationLabel ?? weather.locationLabel}
              </p>
            )}
            <p className="weather-forecast-subhint">Tap a day for a 3-hour hourly breakdown</p>
          </div>

          {forecastLoading && (
            <p className="weather-forecast-muted">Loading forecast…</p>
          )}
          {forecastError && (
            <p className="weather-forecast-error" role="alert">
              {forecastError}
            </p>
          )}
          {!forecastLoading && forecast && forecast.days.length > 0 && (
            <ul className="weather-forecast-days">
              {forecast.days.map(day => {
                const hourlyOpen = expandedDayDate === day.date
                return (
                  <li key={day.date} className="weather-forecast-day-wrap">
                    <button
                      type="button"
                      className={`weather-forecast-day${hourlyOpen ? ' weather-forecast-day--open' : ''}`}
                      aria-expanded={hourlyOpen}
                      aria-controls={`${panelId}-hours-${day.date}`}
                      id={`${panelId}-day-${day.date}`}
                      onClick={e => {
                        e.stopPropagation()
                        toggleDayHourly(day.date)
                      }}
                    >
                      <span className="weather-forecast-day-chevron" aria-hidden="true">
                        {hourlyOpen ? '▼' : '▶'}
                      </span>
                      <div className="weather-forecast-day-meta">
                        <span className="weather-forecast-weekday">{day.weekdayShort}</span>
                        <span className="weather-forecast-date">
                          {day.date.slice(5).replace('-', '/')}
                        </span>
                      </div>
                      <img
                        className="weather-forecast-img"
                        src={openWeatherIconUrl(day.iconCode)}
                        alt=""
                        width={56}
                        height={56}
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="weather-forecast-temps">
                        <span className="weather-forecast-high">{day.high}°</span>
                        <span className="weather-forecast-low">{day.low}°</span>
                      </div>
                      <p className="weather-forecast-desc">{day.description}</p>
                    </button>

                    {hourlyOpen && (
                      <div
                        id={`${panelId}-hours-${day.date}`}
                        className="weather-hourly-scroll"
                        role="region"
                        aria-labelledby={`${panelId}-day-${day.date}`}
                      >
                        {day.hours.length === 0 ? (
                          <p className="weather-forecast-muted weather-hourly-empty">
                            No hourly slots for this day.
                          </p>
                        ) : (
                          <ul className="weather-hourly-list">
                            {[...day.hours].sort((a, b) => a.dt - b.dt).map(h => (
                              <li key={`${day.date}-${h.dt}`} className="weather-hourly-row">
                                <span className="weather-hourly-time">{h.timeLabel}</span>
                                <img
                                  className="weather-hourly-icon"
                                  src={openWeatherIconUrl(h.iconCode, '1x')}
                                  alt=""
                                  width={36}
                                  height={36}
                                  loading="lazy"
                                  decoding="async"
                                />
                                <span className="weather-hourly-temp">{h.temp}°</span>
                                <div className="weather-hourly-wind">
                                  <span
                                    className="weather-hourly-wind-arrow"
                                    style={{ transform: `rotate(${h.windDeg + 180}deg)` }}
                                    title={`Wind from ${windDegToCompass(h.windDeg)}`}
                                    aria-hidden
                                  >
                                    ↑
                                  </span>
                                  <span className="weather-hourly-wind-text">
                                    <span className="weather-hourly-wind-dir">
                                      {windDegToCompass(h.windDeg)}
                                    </span>
                                    <span className="weather-hourly-wind-speed">
                                      {h.windSpeed} mph
                                    </span>
                                  </span>
                                </div>
                                <span className="weather-hourly-conditions">
                                  <span className="weather-hourly-desc">{h.description}</span>
                                  {shouldShowPrecipitation(h) && (
                                    <span className="weather-hourly-precip" aria-label="Precipitation">
                                      {Math.round(h.pop * 100)}% chance
                                      {h.precipInPerHr != null && h.precipInPerHr >= 0.0005 ? (
                                        <>
                                          {' '}
                                          · {formatPrecipInPerHr(h.precipInPerHr)} in/hr
                                        </>
                                      ) : null}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <p className="weather-forecast-hint">Click outside or move away to close</p>
        </div>
      )}
    </div>
  )
}
