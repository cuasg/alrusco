import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { HomeEditModal } from '../ui/HomeEditModal'
import { HomeEarthEmbed } from '../ui/HomeEarthEmbed'
import { FALLBACK_HOME, type HomeConfig } from '../types/home'

export function HomePage() {
  const [config, setConfig] = useState<HomeConfig>(FALLBACK_HOME)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/public/home')
        if (!res.ok) {
          throw new Error(`Failed to load home config: ${res.status}`)
        }

        const data = (await res.json()) as Partial<HomeConfig> | null
        if (!cancelled && data) {
          setConfig((prev) => ({
            ...prev,
            ...data,
            highlights: data.highlights && data.highlights.length ? data.highlights : prev.highlights,
          }))
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError('Using default homepage content while live data loads.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="page home-page">
      <div className="home-hero">
        <div className="home-hero-text">
          <div className="eyebrow">{config.eyebrow}</div>
          <h1>{config.heading}</h1>
          <p className="tagline">{config.tagline}</p>
          {user && (
            <button
              type="button"
              className="btn btn-ghost btn-sm home-edit-button"
              onClick={() => setEditOpen(true)}
            >
              Edit home content
            </button>
          )}
          <div className="home-hero-actions">
            <a href="/projects" className="btn btn-primary">
              View projects
            </a>
            <a href="/projects?category=infra" className="btn btn-ghost">
              See the homelab
            </a>
          </div>
          {loading && <p className="muted-text">Loading homepage content…</p>}
          {error && (
            <p className="muted-text" role="status">
              {error}
            </p>
          )}
        </div>
        <div className="home-hero-visual">
          {config.bannerImageUrl ? (
            <img src={config.bannerImageUrl} alt="" className="home-hero-banner" />
          ) : (
            <HomeEarthEmbed />
          )}
        </div>
      </div>

      <div className="home-highlights">
        {config.highlights.map((item) => (
          <article key={item.title} className="card">
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </div>

      <HomeEditModal
        open={editOpen}
        initialConfig={config}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setConfig((prev) => ({
            ...prev,
            ...updated,
            highlights:
              updated.highlights && updated.highlights.length ? updated.highlights : prev.highlights,
          }))
          setEditOpen(false)
        }}
      />
    </section>
  )
}

