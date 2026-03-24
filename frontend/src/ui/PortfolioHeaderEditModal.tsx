import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

type PhotoRow = {
  id: number
  url: string
  title: string
}

type Props = {
  open: boolean
  displayName: string
  positioningHtml: string
  headshotUrl: string | null
  onClose: () => void
  onSave: (payload: {
    displayName: string
    positioningHtml: string
    headshotUrl: string | null
  }) => Promise<void>
}

export function PortfolioHeaderEditModal({
  open,
  displayName: initialName,
  positioningHtml: initialPositioning,
  headshotUrl: initialHeadshot,
  onClose,
  onSave,
}: Props) {
  const [displayName, setDisplayName] = useState('')
  const [positioningHtml, setPositioningHtml] = useState('')
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryPhotos, setLibraryPhotos] = useState<PhotoRow[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/photos')
      if (!res.ok) throw new Error('Could not load photos')
      const data = (await res.json()) as { photos?: PhotoRow[] }
      setLibraryPhotos(data.photos?.slice(0, 60) ?? [])
    } catch {
      setLibraryPhotos([])
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setDisplayName(initialName)
    setPositioningHtml(initialPositioning)
    setHeadshotUrl(initialHeadshot)
    setLibraryOpen(false)
    setError(null)
    setSaving(false)
  }, [open, initialName, initialPositioning, initialHeadshot])

  useEffect(() => {
    if (open && libraryOpen) {
      void loadLibrary()
    }
  }, [open, libraryOpen, loadLibrary])

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    await uploadFile(file)
  }

  async function uploadFile(file: File) {
    setUploadBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/portfolio/headshot', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }
      if (data.url) {
        setHeadshotUrl(data.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ displayName: displayName.trim(), positioningHtml, headshotUrl })
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
        className="modal portfolio-edit-modal portfolio-header-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-header-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="portfolio-modal-title-row">
          <h2 id="portfolio-header-edit-title">Edit header &amp; photo</h2>
          <button type="button" className="btn btn-ghost portfolio-modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="portfolio-edit-form">
          <div className="portfolio-header-photo-block">
            <p className="portfolio-edit-label">Professional photo</p>
            <div
              className="portfolio-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void handleDrop(e)}
            >
              {headshotUrl ? (
                <img src={headshotUrl} alt="" className="portfolio-headshot-preview" />
              ) : (
                <div className="portfolio-dropzone-placeholder">No photo selected</div>
              )}
            </div>
            <div className="portfolio-photo-actions">
              <label className="btn btn-ghost portfolio-file-label">
                {uploadBusy ? 'Uploading…' : 'Upload image'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
                  className="sr-only"
                  disabled={uploadBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadFile(f)
                    e.target.value = ''
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setLibraryOpen((o) => !o)}
              >
                {libraryOpen ? 'Hide library' : 'Choose from photos'}
              </button>
              {headshotUrl && (
                <button type="button" className="btn btn-ghost" onClick={() => setHeadshotUrl(null)}>
                  Remove photo
                </button>
              )}
            </div>

            {libraryOpen && (
              <div className="portfolio-photo-library">
                {libraryLoading && <p className="muted-text">Loading…</p>}
                {!libraryLoading && !libraryPhotos.length && (
                  <p className="muted-text">No photos in library yet.</p>
                )}
                <div className="portfolio-photo-library-grid">
                  {libraryPhotos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={
                        headshotUrl === p.url
                          ? 'portfolio-library-thumb portfolio-library-thumb--active'
                          : 'portfolio-library-thumb'
                      }
                      onClick={() => setHeadshotUrl(p.url)}
                      title={p.title}
                    >
                      <img src={p.url} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="portfolio-edit-field">
            <label htmlFor="portfolio-display-name">Name</label>
            <input
              id="portfolio-display-name"
              className="input portfolio-text-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={200}
              autoComplete="name"
            />
          </div>

          <div className="portfolio-edit-field">
            <label htmlFor="portfolio-positioning">Positioning (HTML)</label>
            <textarea
              id="portfolio-positioning"
              className="portfolio-html-textarea"
              value={positioningHtml}
              onChange={(e) => setPositioningHtml(e.target.value)}
              rows={6}
              spellCheck={false}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save header'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
