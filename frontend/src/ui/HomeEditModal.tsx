import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import type { HomeConfig, HomeHighlight } from '../types/home'

type Props = {
  open: boolean
  initialConfig: HomeConfig | null
  onClose: () => void
  onSaved: (config: HomeConfig) => void
}

export function HomeEditModal({ open, initialConfig, onClose, onSaved }: Props) {
  const [eyebrow, setEyebrow] = useState('')
  const [heading, setHeading] = useState('')
  const [tagline, setTagline] = useState('')
  const [bannerImageUrl, setBannerImageUrl] = useState('')
  const [highlights, setHighlights] = useState<HomeHighlight[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    if (initialConfig) {
      setEyebrow(initialConfig.eyebrow)
      setHeading(initialConfig.heading)
      setTagline(initialConfig.tagline)
      setBannerImageUrl(initialConfig.bannerImageUrl ?? '')
      setHighlights(
        initialConfig.highlights && initialConfig.highlights.length
          ? initialConfig.highlights
          : [{ title: '', description: '' }],
      )
    } else {
      setEyebrow('')
      setHeading('')
      setTagline('')
      setBannerImageUrl('')
      setHighlights([{ title: '', description: '' }])
    }

    setError(null)
    setSaving(false)
  }, [open, initialConfig])

  function handleBackdropClick(_e: React.MouseEvent<HTMLDivElement>) {
    // Intentionally do nothing to prevent accidental close on backdrop click
  }

  function updateHighlight(index: number, field: keyof HomeHighlight, value: string) {
    setHighlights((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    )
  }

  function addHighlight() {
    setHighlights((prev) => [...prev, { title: '', description: '' }])
  }

  function removeHighlight(index: number) {
    setHighlights((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    const cleanedHighlights = highlights
      .map((h) => ({
        title: h.title.trim(),
        description: h.description.trim(),
      }))
      .filter((h) => h.title || h.description)

    const payload: HomeConfig = {
      eyebrow: eyebrow.trim(),
      heading: heading.trim(),
      tagline: tagline.trim(),
      highlights: cleanedHighlights,
      bannerImageUrl: bannerImageUrl.trim() || null,
    }

    try {
      const res = await fetch('/api/admin/home', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Failed to save homepage settings')
      }

      onSaved(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save homepage settings')
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="home-modal-title">
        <h2 id="home-modal-title">Edit homepage content</h2>
        <form className="settings-card" onSubmit={handleSubmit}>
          <label>
            Eyebrow
            <input
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              placeholder="Homelab · Infrastructure · Applications"
              required
            />
          </label>
          <label>
            Main heading
            <input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="Designing reliable systems at home and at work."
              required
            />
          </label>
          <label>
            Tagline
            <textarea
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              rows={3}
              required
            />
          </label>
          <label>
            Banner image URL (optional)
            <input
              value={bannerImageUrl}
              onChange={(e) => setBannerImageUrl(e.target.value)}
              placeholder="/images/home-hero.jpg or https://…"
            />
          </label>

          <fieldset className="fieldset">
            <legend>Highlight cards</legend>
            {highlights.map((h, index) => (
              <div key={index} className="highlight-fields">
                <label>
                  Title
                  <input
                    value={h.title}
                    onChange={(e) => updateHighlight(index, 'title', e.target.value)}
                    placeholder="Infrastructure"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={h.description}
                    onChange={(e) => updateHighlight(index, 'description', e.target.value)}
                    rows={3}
                  />
                </label>
                {highlights.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeHighlight(index)}
                    disabled={saving}
                  >
                    Remove highlight
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={addHighlight}
              disabled={saving}
            >
              Add highlight
            </button>
          </fieldset>

          {error && (
            <p className="error-text" role="status">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save homepage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

