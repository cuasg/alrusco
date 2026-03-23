import { useEffect, useState } from 'react'

type WeatherData = {
  temperature: number
  description: string
  icon: string | null
  weekday: string
  locationLabel: string | null
}

export function WeatherBadge() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    let coords: { lat?: number; lon?: number } = {}

    async function fetchWeather() {
      try {
        const searchParams = new URLSearchParams()
        if (coords.lat != null && coords.lon != null) {
          searchParams.set('lat', String(coords.lat))
          searchParams.set('lon', String(coords.lon))
        }

        const url = searchParams.toString() ? `/api/weather?${searchParams.toString()}` : '/api/weather'

        const res = await fetch(url)
        if (!res.ok) {
          throw new Error('Weather unavailable')
        }
        const data = (await res.json()) as WeatherData
        if (!cancelled) {
          setWeather(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Weather unavailable')
        }
      }
    }

    function requestWithGeolocation() {
      if (!('geolocation' in navigator)) {
        void fetchWeather()
        return
      }

      let resolved = false

      const fallbackTimeout = window.setTimeout(() => {
        if (!resolved) {
          resolved = true
          void fetchWeather()
        }
      }, 5000)

      navigator.geolocation.getCurrentPosition(
        position => {
          if (resolved) return
          resolved = true
          window.clearTimeout(fallbackTimeout)

          coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          }

          void fetchWeather()
        },
        () => {
          if (resolved) return
          resolved = true
          window.clearTimeout(fallbackTimeout)
          void fetchWeather()
        },
        {
          enableHighAccuracy: false,
          maximumAge: 10 * 60 * 1000,
          timeout: 4000,
        },
      )
    }

    requestWithGeolocation()
    const id = window.setInterval(fetchWeather, 15 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

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
      ? `Weather — ${weather.locationLabel}`
      : `Weather — ${weather.description}`

  return (
    <div className="weather-badge" aria-label={`Weather ${weather.description}`} title={tooltip}>
      <span className="weather-day">{weather.weekday}</span>
      {weather.icon && <span className="weather-icon">{weather.icon}</span>}
      <span className="weather-temp">{Math.round(weather.temperature)}°F</span>
    </div>
  )
}


