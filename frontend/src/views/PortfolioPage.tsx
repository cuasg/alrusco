import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { PortfolioHeaderEditModal } from '../ui/PortfolioHeaderEditModal'
import { PortfolioSectionEditModal } from '../ui/PortfolioSectionEditModal'
import {
  PORTFOLIO_SECTION_LABELS,
  type PortfolioData,
  type PortfolioSectionKey,
} from '../types/portfolio'

function HtmlContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={className ? `pp-html ${className}` : 'pp-html'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function PortfolioPage() {
  const { user, loading: authLoading } = useAuth()
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [headerEditOpen, setHeaderEditOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<PortfolioSectionKey | null>(null)

  const loadPublic = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/public/portfolio')
      if (!res.ok) {
        throw new Error(`Could not load portfolio (${res.status})`)
      }
      const data = (await res.json()) as PortfolioData
      setPortfolio(data)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load portfolio')
      setPortfolio(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPublic()
  }, [loadPublic])

  const persist = useCallback(async (next: PortfolioData) => {
    const res = await fetch('/api/admin/portfolio', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(next),
    })
    const data = (await res.json().catch(() => ({}))) as { portfolio?: PortfolioData; error?: string }
    if (!res.ok) {
      throw new Error(data.error || 'Save failed')
    }
    if (data.portfolio) {
      setPortfolio(data.portfolio)
    }
  }, [])

  if (loading) {
    return (
      <section className="page portfolio-page pp-page">
        <p className="muted-text">Loading portfolio…</p>
      </section>
    )
  }

  if (loadError || !portfolio) {
    return (
      <section className="page portfolio-page pp-page">
        <p className="error-text" role="status">
          {loadError || 'Portfolio unavailable.'}
        </p>
      </section>
    )
  }

  return (
    <section className="page portfolio-page pp-page">
      {user && !authLoading && (
        <div className="pp-admin-bar">
          <span className="pp-admin-label">Signed in</span>
          <button type="button" className="btn btn-ghost" onClick={() => setHeaderEditOpen(true)}>
            Edit header &amp; photo
          </button>
        </div>
      )}

      <header className="pp-intro">
        <div className="pp-intro-visual">
          {portfolio.headshotUrl ? (
            <img src={portfolio.headshotUrl} alt="" className="pp-headshot" />
          ) : (
            <div className="pp-headshot pp-headshot--placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="pp-intro-copy">
          <h1 className="pp-name">{portfolio.displayName}</h1>
          <HtmlContent html={portfolio.sections.positioning} className="pp-positioning pp-prose" />
        </div>
      </header>

      <section className="pp-section" aria-labelledby="pp-summary-heading">
        <div className="pp-section-head">
          <h2 id="pp-summary-heading">Professional summary</h2>
          {user && !authLoading && (
            <button
              type="button"
              className="btn btn-ghost pp-section-edit"
              onClick={() => setEditingSection('summary')}
            >
              Edit
            </button>
          )}
        </div>
        <HtmlContent html={portfolio.sections.summary} className="pp-prose" />
      </section>

      <section className="pp-section pp-section--timeline" aria-labelledby="pp-exp-heading">
        <div className="pp-section-head">
          <h2 id="pp-exp-heading">Experience</h2>
          {user && !authLoading && (
            <button
              type="button"
              className="btn btn-ghost pp-section-edit"
              onClick={() => setEditingSection('experience')}
            >
              Edit
            </button>
          )}
        </div>
        <HtmlContent html={portfolio.sections.experience} className="pp-prose" />
      </section>

      <section
        className="pp-section pp-section--msi"
        aria-labelledby="pp-msi-heading"
      >
        <div className="pp-section-head">
          <h2 id="pp-msi-heading">Systems, workflows, and operational execution</h2>
          {user && !authLoading && (
            <button
              type="button"
              className="btn btn-ghost pp-section-edit"
              onClick={() => setEditingSection('msiSystems')}
            >
              Edit
            </button>
          )}
        </div>
        <p className="pp-section-lede">
          Technical depth from national account work — how data, inventory, and EDI actually behave in
          production.
        </p>
        <HtmlContent html={portfolio.sections.msiSystems} className="pp-prose" />
      </section>

      <section className="pp-section" aria-labelledby="pp-impact-heading">
        <div className="pp-section-head">
          <h2 id="pp-impact-heading">Key achievements</h2>
          {user && !authLoading && (
            <button
              type="button"
              className="btn btn-ghost pp-section-edit"
              onClick={() => setEditingSection('achievements')}
            >
              Edit
            </button>
          )}
        </div>
        <HtmlContent html={portfolio.sections.achievements} className="pp-prose" />
      </section>

      <section className="pp-section" aria-labelledby="pp-skills-heading">
        <div className="pp-section-head">
          <h2 id="pp-skills-heading">Skills</h2>
          {user && !authLoading && (
            <button
              type="button"
              className="btn btn-ghost pp-section-edit"
              onClick={() => setEditingSection('skills')}
            >
              Edit
            </button>
          )}
        </div>
        <HtmlContent html={portfolio.sections.skills} className="pp-prose" />
      </section>

      <section className="pp-section pp-section--last" aria-labelledby="pp-edu-heading">
        <div className="pp-section-head">
          <h2 id="pp-edu-heading">Education &amp; certifications</h2>
          {user && !authLoading && (
            <button
              type="button"
              className="btn btn-ghost pp-section-edit"
              onClick={() => setEditingSection('education')}
            >
              Edit
            </button>
          )}
        </div>
        <HtmlContent html={portfolio.sections.education} className="pp-prose" />
      </section>

      <PortfolioHeaderEditModal
        open={headerEditOpen}
        displayName={portfolio.displayName}
        positioningHtml={portfolio.sections.positioning}
        headshotUrl={portfolio.headshotUrl}
        onClose={() => setHeaderEditOpen(false)}
        onSave={async ({ displayName, positioningHtml, headshotUrl: nextHeadshot }) => {
          await persist({
            ...portfolio,
            displayName,
            headshotUrl: nextHeadshot,
            sections: { ...portfolio.sections, positioning: positioningHtml },
          })
        }}
      />

      {editingSection && (
        <PortfolioSectionEditModal
          open
          title={PORTFOLIO_SECTION_LABELS[editingSection]}
          initialHtml={portfolio.sections[editingSection]}
          onClose={() => setEditingSection(null)}
          onSave={async (html) => {
            await persist({
              ...portfolio,
              sections: { ...portfolio.sections, [editingSection]: html },
            })
          }}
        />
      )}
    </section>
  )
}
