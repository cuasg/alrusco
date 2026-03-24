import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { HomeEditModal } from '../ui/HomeEditModal'
import { HomeHeroLottie } from '../ui/HomeHeroLottie'
import { FALLBACK_HOME, type HomeConfig } from '../types/home'

/**
 * Public homepage — narrative positioning, systems focus, minimal “resume” tone.
 * Hero eyebrow/heading/tagline + banner image sync with /api/public/home when edited by a signed-in user.
 */
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
            highlights: data.highlights?.length ? data.highlights : prev.highlights,
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
    <div className="page home-page">
      {/* —— Hero —— */}
      <header className="hp-hero">
        <div className="hp-hero-grid">
          <div className="hp-hero-copy">
            <p className="hp-eyebrow">{config.eyebrow}</p>
            <h1 className="hp-hero-title">{config.heading}</h1>
            <p className="hp-hero-lede">{config.tagline}</p>

            {user && (
              <button
                type="button"
                className="btn btn-ghost hp-edit-home"
                onClick={() => setEditOpen(true)}
              >
                Edit hero &amp; banner
              </button>
            )}

            <nav className="hp-hero-cta" aria-label="Homepage sections">
              <Link to="/projects" className="hp-cta hp-cta--primary">
                View work
              </Link>
              <a href="#hp-about" className="hp-cta hp-cta--ghost">
                About
              </a>
              <a href="#hp-contact" className="hp-cta hp-cta--ghost">
                Get in touch
              </a>
            </nav>

            {loading && (
              <p className="hp-muted" role="status">
                Loading…
              </p>
            )}
            {error && (
              <p className="hp-muted" role="status">
                {error}
              </p>
            )}
          </div>

          <div className="hp-hero-visual" aria-hidden={!!config.bannerImageUrl}>
            {config.bannerImageUrl ? (
              <img
                src={config.bannerImageUrl}
                alt=""
                className="home-hero-banner hp-hero-banner"
              />
            ) : (
              <HomeHeroLottie />
            )}
          </div>
        </div>
      </header>

      <div className="hp-main">
        {/* —— About —— */}
        <section id="hp-about" className="hp-section" aria-labelledby="hp-about-heading">
          <h2 id="hp-about-heading" className="hp-section-title">
            How I think
          </h2>
          <div className="hp-prose">
            <p>
              I&apos;m someone who naturally gravitates toward <strong>systems</strong>.
            </p>
            <p>
              Whether it&apos;s a server, a workflow, or a business process, I want to understand how it
              works, where it breaks, and how to improve it.
            </p>
            <p>
              A lot of that shows up in the technical side of my life — home infrastructure, self-hosted
              services, and tools I build and run myself. It also carries into my professional work,
              where I spend time on operational problems, connecting systems, and making things run more
              efficiently.
            </p>
            <p className="hp-prose-accent">I&apos;m less interested in theory than in things that actually work.</p>
          </div>
        </section>

        {/* —— Strengths —— */}
        <section className="hp-section" aria-labelledby="hp-strengths-heading">
          <h2 id="hp-strengths-heading" className="hp-section-title">
            What I do best
          </h2>
          <p className="hp-section-intro">
            Three places where the same mindset shows up — infrastructure, automation, and software.
          </p>
          <ul className="hp-card-grid">
            <li className="hp-card">
              <h3 className="hp-card-title">Systems &amp; infrastructure</h3>
              <p className="hp-card-body">
                Building and managing containerized environments, self-hosted services, reverse proxies,
                secure access, and reliable home lab systems.
              </p>
            </li>
            <li className="hp-card">
              <h3 className="hp-card-title">Automation &amp; problem solving</h3>
              <p className="hp-card-body">
                Debugging broken workflows, connecting tools that don&apos;t naturally fit together, and
                turning messy manual processes into structured, repeatable systems.
              </p>
            </li>
            <li className="hp-card">
              <h3 className="hp-card-title">Web &amp; application development</h3>
              <p className="hp-card-body">
                Designing practical web interfaces, working with APIs and backend logic, and building tools
                that are usable, purposeful, and grounded in real needs.
              </p>
            </li>
          </ul>
        </section>

        {/* —— Selected work / systems —— */}
        <section className="hp-section" aria-labelledby="hp-work-heading">
          <h2 id="hp-work-heading" className="hp-section-title">
            Systems I actually run
          </h2>
          <p className="hp-section-intro">
            Real focus areas — not a trophy list. Details live in{' '}
            <Link to="/projects">projects</Link> when I&apos;ve written them up.
          </p>
          <ul className="hp-work-grid">
            <li className="hp-work-item">
              <h3 className="hp-work-title">Home infrastructure &amp; hosting</h3>
              <ul className="hp-work-list">
                <li>Self-hosted environment on Unraid</li>
                <li>Docker-based service layout</li>
                <li>Nginx Proxy Manager for routing and TLS</li>
                <li>Domain management and external access</li>
              </ul>
            </li>
            <li className="hp-work-item">
              <h3 className="hp-work-title">Personal web platform</h3>
              <ul className="hp-work-list">
                <li>Containerized site (frontend + API)</li>
                <li>Unified deployment for homepage and tools</li>
                <li>Front door to homelab services I choose to expose</li>
              </ul>
            </li>
            <li className="hp-work-item">
              <h3 className="hp-work-title">Debugging &amp; recovery</h3>
              <ul className="hp-work-list">
                <li>Container, networking, and reverse-proxy issues</li>
                <li>TLS and certificate failures</li>
                <li>Rebuilding after outages, misconfiguration, or drift</li>
              </ul>
            </li>
            <li className="hp-work-item">
              <h3 className="hp-work-title">Workflow &amp; integration thinking</h3>
              <ul className="hp-work-list">
                <li>Turning messy processes into clearer systems</li>
                <li>How data, workflows, and operations connect</li>
                <li>Bridging technical detail and practical business constraints</li>
              </ul>
            </li>
          </ul>
        </section>

        {/* —— Skills —— */}
        <section className="hp-section" aria-labelledby="hp-skills-heading">
          <h2 id="hp-skills-heading" className="hp-section-title">
            Tools &amp; capabilities
          </h2>
          <div className="hp-skills">
            <div className="hp-skill-col">
              <h3 className="hp-skill-heading">Infrastructure</h3>
              <ul className="hp-chip-list">
                <li>Docker</li>
                <li>Unraid</li>
                <li>Nginx / reverse proxy</li>
                <li>Networking fundamentals</li>
                <li>Self-hosting</li>
              </ul>
            </div>
            <div className="hp-skill-col">
              <h3 className="hp-skill-heading">Development</h3>
              <ul className="hp-chip-list">
                <li>Frontend (React, TypeScript)</li>
                <li>Backend APIs (Node)</li>
                <li>API integration</li>
                <li>Web architecture</li>
                <li>Containerized deployment</li>
              </ul>
            </div>
            <div className="hp-skill-col">
              <h3 className="hp-skill-heading">Systems thinking</h3>
              <ul className="hp-chip-list">
                <li>Debugging</li>
                <li>Process design</li>
                <li>Cross-system integration</li>
                <li>Troubleshooting</li>
                <li>Workflow optimization</li>
              </ul>
            </div>
          </div>
        </section>

        {/* —— Professional context (secondary) —— */}
        <section className="hp-section hp-section--muted" aria-labelledby="hp-pro-heading">
          <h2 id="hp-pro-heading" className="hp-section-title hp-section-title--subtle">
            Professional context
          </h2>
          <div className="hp-prose hp-prose--compact">
            <p>
              I work as a <strong>National Accounts Manager</strong> in industrial distribution. That role
              is heavy on operations, coordination, and large-scale workflow execution — especially where
              technology, logistics, and practical problem-solving meet.
            </p>
            <p>
              The title matters less than what it taught me: how complex systems behave in the real world,
              under real constraints.
            </p>
          </div>
        </section>

        {/* —— Interests —— */}
        <section className="hp-section" aria-labelledby="hp-interests-heading">
          <h2 id="hp-interests-heading" className="hp-section-title">
            Outside of work
          </h2>
          <div className="hp-prose">
            <p>
              I&apos;m usually building, fixing, or improving something — a{' '}
              <strong>1975 Corvette</strong>, a mechanical issue, infrastructure in the home lab, or a
              workflow that should work better than it does.
            </p>
            <p className="hp-prose-accent">
              Same approach everywhere: understand it, break it down, improve it.
            </p>
          </div>
        </section>

        {/* —— Contact / closing —— */}
        <section id="hp-contact" className="hp-section hp-section--closing" aria-labelledby="hp-contact-heading">
          <h2 id="hp-contact-heading" className="hp-section-title">
            Connect
          </h2>
          <p className="hp-closing-line">
            Always open to connecting, collaborating, or talking through interesting work, ideas, and
            systems.
          </p>
          <div className="hp-contact-actions">
            <Link to="/projects" className="hp-cta hp-cta--primary">
              Browse projects
            </Link>
            <Link to="/portfolio" className="hp-cta hp-cta--ghost">
              Portfolio
            </Link>
            <Link to="/photos" className="hp-cta hp-cta--ghost">
              Photos
            </Link>
          </div>
          <p className="hp-muted hp-contact-note">
            If we already know each other, use whichever channel we use today — no contact form on this
            site.
          </p>
        </section>
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
    </div>
  )
}
