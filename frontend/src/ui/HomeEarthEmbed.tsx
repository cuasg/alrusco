import { useEffect, useRef, useState } from 'react'
import type { WebGLEarthMap } from '../types/webglearth'

/** Hosted WebGL Earth 2 bundle — see https://github.com/webglearth/webglearth2 */
const WEBGL_EARTH_SCRIPT = 'https://www.webglearth.com/v2/api.js'
const CONTAINER_ID = 'alrusco-webglearth-home'

/** Current OSM standard tile URL (avoids deprecated {s} subdomains in some stacks) */
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

function ensureWebGLEarthScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no window'))
  }
  if (window.WE) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-alrusco-webglearth="1"]',
    ) as HTMLScriptElement | null
    if (existing) {
      const done = () => (window.WE ? resolve() : reject(new Error('WE missing after load')))
      if (window.WE) {
        resolve()
        return
      }
      existing.addEventListener('load', done, { once: true })
      existing.addEventListener('error', () => reject(new Error('script error')), { once: true })
      return
    }

    const s = document.createElement('script')
    s.src = WEBGL_EARTH_SCRIPT
    s.async = true
    s.dataset.alruscoWebglearth = '1'
    s.onload = () => {
      if (window.WE) resolve()
      else reject(new Error('WE not defined after load'))
    }
    s.onerror = () => reject(new Error('Failed to load WebGL Earth'))
    document.head.appendChild(s)
  })
}

/**
 * WebGL Earth 2 globe with OSM tiles. Idle rotation by advancing longitude
 * while the pointer is outside the globe area (same interaction model as before).
 *
 * Note: upstream project is unmaintained; if the CDN or WebGL breaks over time,
 * consider switching to Cesium (their recommendation).
 */
export function HomeEarthEmbed() {
  const pointerInsideRef = useRef(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let earth: WebGLEarthMap | null = null
    let rafId = 0
    let lastTick = 0
    let lng = -45
    const lat = 12
    const zoom = 2
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const container = document.getElementById(CONTAINER_ID)
    if (!container) return

    /** Faster idle spin than before; don’t call setView every frame — that can block OSM tiles (gray globe). */
    const ROTATE_MS = 75
    const LNG_STEP = 0.82

    function loop(t: number) {
      if (cancelled || !earth) return
      if (!reduceMotion && !pointerInsideRef.current && t - lastTick >= ROTATE_MS) {
        lastTick = t
        lng += LNG_STEP
        if (lng > 180) lng -= 360
        try {
          earth.setView([lat, lng], zoom)
        } catch {
          /* ignore frame errors */
        }
      }
      rafId = requestAnimationFrame(loop)
    }

    setLoadError(null)

    ensureWebGLEarthScript()
      .then(() => {
        if (cancelled || !window.WE) return
        earth = window.WE.map(CONTAINER_ID)
        window.WE
          .tileLayer(OSM_TILES, {
            attribution: '© OpenStreetMap contributors',
            minZoom: 0,
            maxZoom: 19,
          })
          .addTo(earth)
        earth.setView([lat, lng], zoom)
        if (!reduceMotion) {
          rafId = requestAnimationFrame(loop)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) {
          setLoadError('Globe could not load. Try opening the project on GitHub for details.')
        }
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      try {
        if (earth && typeof earth.remove === 'function') {
          earth.remove()
        }
      } catch {
        /* ignore */
      }
      earth = null
      container.innerHTML = ''
    }
  }, [])

  return (
    <div className="home-earth-embed">
      <div
        className="home-earth-frame-wrap"
        onPointerEnter={() => {
          pointerInsideRef.current = true
        }}
        onPointerLeave={() => {
          pointerInsideRef.current = false
        }}
      >
        <div id={CONTAINER_ID} className="home-webglearth-map" />
        {loadError && (
          <p className="home-earth-error" role="alert">
            {loadError}
          </p>
        )}
      </div>
      <div className="home-earth-credits">
        <a
          className="home-earth-credit"
          href="https://github.com/webglearth/webglearth2"
          target="_blank"
          rel="noopener noreferrer"
        >
          WebGL Earth 2 (Apache-2.0)
        </a>
        <span className="home-earth-credit-sep" aria-hidden="true">
          ·
        </span>
        <a
          className="home-earth-credit"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          Map tiles © OpenStreetMap
        </a>
      </div>
    </div>
  )
}
