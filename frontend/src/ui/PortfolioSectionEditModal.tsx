import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  title: string
  initialHtml: string
  onClose: () => void
  onSave: (html: string) => Promise<void>
}

export function PortfolioSectionEditModal({ open, title, initialHtml, onClose, onSave }: Props) {
  const [html, setHtml] = useState('')
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setHtml(initialHtml)
    setTab('edit')
    setPreviewHtml('')
    setPreviewError(null)
    setError(null)
    setSaving(false)
  }, [open, initialHtml])

  async function runPreview() {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const res = await fetch('/api/admin/portfolio/sanitize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html }),
      })
      const data = (await res.json().catch(() => ({}))) as { html?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Preview failed')
      }
      setPreviewHtml(data.html ?? '')
      setTab('preview')
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave(html)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal portfolio-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-section-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="portfolio-modal-title-row">
          <h2 id="portfolio-section-edit-title">Edit: {title}</h2>
          <button type="button" className="btn btn-ghost portfolio-modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="portfolio-edit-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'edit'}
            className={tab === 'edit' ? 'portfolio-edit-tab portfolio-edit-tab--active' : 'portfolio-edit-tab'}
            onClick={() => setTab('edit')}
          >
            HTML
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={
              tab === 'preview' ? 'portfolio-edit-tab portfolio-edit-tab--active' : 'portfolio-edit-tab'
            }
            onClick={() => setTab('preview')}
          >
            Preview
          </button>
        </div>

        <form onSubmit={handleSubmit} className="portfolio-edit-form">
          {tab === 'edit' && (
            <div className="portfolio-edit-field">
              <label htmlFor="portfolio-html-input">Raw HTML (sanitized on save)</label>
              <textarea
                id="portfolio-html-input"
                className="portfolio-html-textarea"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={18}
                spellCheck={false}
              />
              <p className="portfolio-edit-hint">
                Allowed tags include paragraphs, lists, headings, links, emphasis, and code blocks. Scripts
                and inline handlers are stripped server-side.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void runPreview()}
                disabled={previewLoading}
              >
                {previewLoading ? 'Sanitizing…' : 'Generate preview'}
              </button>
              {previewError && <p className="error-text">{previewError}</p>}
            </div>
          )}

          {tab === 'preview' && (
            <div className="portfolio-html-preview-wrap">
              {previewHtml ? (
                <div
                  className="portfolio-html-preview pp-prose pp-html"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="muted-text">Switch to HTML and choose &ldquo;Generate preview&rdquo; to see sanitized output.</p>
              )}
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
