import { useCallback, useEffect, useId, useRef, useState } from 'react'

type WeatherData = {
  temperature: number
  description: string
  icon: string | null
  weekday: string
  locationLabel: string | null
}

type ForecastDay = {
  date: string
  weekdayShort: string
  high: number
  low: number
  description: string
  iconCode: string
  main: string
}

type ForecastData = {
  days: ForecastDay[]
  locationLabel: string | null
}

function openWeatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`
}

function weatherUrl(path: string, coords: { lat: number; lon: number } | null): string {
  if (!coords) return path
  const q = new URLSearchParams()
  q.set('lat', String(coords.lat))
  q.set('lon', String(coords.lon))
  return `${path}?${q.toString()}`
}

export function WeatherBadge() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)

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
      setForecast(data)
    } catch (e) {
      setForecastError(e instanceof Error ? e.message : 'Forecast unavailable')
    } finally {
      setForecastLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!expanded) {
      setForecastError(null)
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
      ? `Weather — ${weather.locationLabel}. Click for 5-day forecast.`
      : `Weather — ${weather.description}. Click for 5-day forecast.`

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
              {forecast.days.map(day => (
                <li key={day.date} className="weather-forecast-day">
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
                </li>
              ))}
            </ul>
          )}

          <p className="weather-forecast-hint">Click outside or move away to close</p>
        </div>
      )}
    </div>
  )
}
