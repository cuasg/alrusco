import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

type Album = {
  id: number
  name: string
  description: string | null
  createdAt: string
}

type Props = {
  open: boolean
  initialAlbum: Album | null
  onClose: () => void
  onChanged: () => void
}

type ApiAlbum = {
  id: number
  name: string
  description: string | null
  createdAt: string
}

export function AlbumEditModal({ open, initialAlbum, onClose, onChanged }: Props) {
  const isEdit = Boolean(initialAlbum)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    if (initialAlbum) {
      setName(initialAlbum.name)
      setDescription(initialAlbum.description ?? '')
    } else {
      setName('')
      setDescription('')
    }
    setError(null)
    setSaving(false)
  }, [open, initialAlbum])

  function handleBackdropClick(_e: React.MouseEvent<HTMLDivElement>) {
    // Intentionally do nothing to prevent accidental close on backdrop click
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    try {
      const payload = {
        name,
        description: description.trim() ? description : null,
      }

      const url = isEdit ? `/api/admin/albums/${initialAlbum!.id}` : '/api/admin/albums'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await res.json().catch(() => ({}))) as { album?: ApiAlbum; error?: string }
      if (!res.ok || !data.album) {
        throw new Error(data.error || 'Failed to save album')
      }

      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save album')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialAlbum) return
    if (!window.confirm(`Delete album "${initialAlbum.name}"? This cannot be undone.`)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/albums/${initialAlbum.id}`, {
        method: 'DELETE',
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || data.ok !== true) {
        throw new Error(data.error || 'Failed to delete album')
      }

      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete album')
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="album-modal-title">
        <h2 id="album-modal-title">{isEdit ? 'Edit album' : 'New album'}</h2>
        <form className="settings-card" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Description (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>
          {error && (
            <p className="error-text" role="status">
              {error}
            </p>
          )}
          <div className="modal-actions">
            {isEdit && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleDelete}
                disabled={saving}
              >
                Delete album
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create album'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

