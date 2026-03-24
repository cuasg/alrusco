import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

type Photo = {
  id: number
  title: string
  description: string | null
  url: string
  originalUrl?: string | null
  category: string
  takenAt: string | null
  createdAt: string
  tags: string[]
  albums: string[]
}

type Album = {
  id: number
  name: string
  description: string | null
  createdAt: string
}

type Props = {
  open: boolean
  initialPhoto: Photo | null
  albums: Album[]
  onClose: () => void
  onChanged: () => void
  /** When creating photos, pre-select this album (e.g. album view page). */
  defaultAlbumId?: number | null
  /** When creating photos, pre-select this project gallery. */
  defaultProjectId?: number | null
  /** Hide collection radios; use default album/project only (typically for new photos on a collection page). */
  lockCollection?: boolean
  /** When editing from a collection view, seed album/project (API list may omit album names). */
  initialCollection?:
    | { kind: 'album'; albumId: number }
    | { kind: 'project'; projectId: number }
  /** Allow multi-select + bulk upload (new photos only). */
  allowMultipleFiles?: boolean
}

type ApiPhoto = {
  id: number
  title: string
  description: string | null
  url: string
  originalUrl?: string | null
  category: string
  takenAt: string | null
  createdAt: string
  tags: string[]
  albumIds: number[]
}

type ApiProject = {
  id: number
  title: string
}

export function PhotoEditModal({
  open,
  initialPhoto,
  albums,
  onClose,
  onChanged,
  defaultAlbumId = null,
  defaultProjectId = null,
  lockCollection = false,
  initialCollection,
  allowMultipleFiles = false,
}: Props) {
  const isEdit = Boolean(initialPhoto)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('')
  const [takenAt, setTakenAt] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  const [collectionMode, setCollectionMode] = useState<'uncategorized' | 'album' | 'project'>(
    'uncategorized',
  )
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [filesList, setFilesList] = useState<File[]>([])

  useEffect(() => {
    if (!open) return

    if (initialPhoto) {
      setTitle(initialPhoto.title)
      setDescription(initialPhoto.description ?? '')
      setUrl(initialPhoto.url)
      setCategory(initialPhoto.category)
      setTakenAt(initialPhoto.takenAt ?? '')
      setTagsInput(initialPhoto.tags.join(', '))
    } else {
      setTitle('')
      setDescription('')
      setUrl('')
      setCategory('')
      setTakenAt('')
      setTagsInput('')
    }
    setError(null)
    setSaving(false)
    setFile(null)
    setFilesList([])

    const uncategorizedAlbum = albums.find((a) => a.name === 'Uncategorized')
    const firstAlbumName = initialPhoto?.albums?.[0] ?? null
    const initialAlbumId =
      firstAlbumName != null ? albums.find((a) => a.name === firstAlbumName)?.id ?? null : null

    if (initialPhoto && initialCollection) {
      if (initialCollection.kind === 'project') {
        setCollectionMode('project')
        setSelectedProjectId(initialCollection.projectId)
        setSelectedAlbumId(uncategorizedAlbum?.id ?? null)
      } else {
        setCollectionMode('album')
        setSelectedAlbumId(initialCollection.albumId)
        setSelectedProjectId(null)
      }
    } else if (initialPhoto) {
      if (initialAlbumId != null) {
        setCollectionMode('album')
        setSelectedAlbumId(initialAlbumId)
      } else {
        setCollectionMode('uncategorized')
        setSelectedAlbumId(uncategorizedAlbum?.id ?? null)
      }
      setSelectedProjectId(null)
    } else if (defaultProjectId != null) {
      setCollectionMode('project')
      setSelectedProjectId(defaultProjectId)
      setSelectedAlbumId(uncategorizedAlbum?.id ?? null)
    } else if (defaultAlbumId != null) {
      setCollectionMode('album')
      setSelectedAlbumId(defaultAlbumId)
      setSelectedProjectId(null)
    } else {
      setCollectionMode('uncategorized')
      setSelectedAlbumId(uncategorizedAlbum?.id ?? null)
      setSelectedProjectId(null)
    }

    // Load projects once per modal open for the "Project" collection mode.
    async function loadProjects() {
      setProjectsLoading(true)
      try {
        const res = await fetch('/api/projects', { credentials: 'include' })
        if (!res.ok) throw new Error(`Failed to load projects: ${res.status}`)
        const data = (await res.json().catch(() => ({}))) as { projects?: ApiProject[] }
        setProjects(Array.isArray(data.projects) ? data.projects : [])
      } catch (err) {
        console.error(err)
      } finally {
        setProjectsLoading(false)
      }
    }

    void loadProjects()
  }, [open, initialPhoto, initialCollection, albums, defaultAlbumId, defaultProjectId])

  function handleBackdropClick(_e: React.MouseEvent<HTMLDivElement>) {
    // Intentionally do nothing to prevent accidental close on backdrop click
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const uncategorizedAlbumId = albums.find((a) => a.name === 'Uncategorized')?.id ?? null

    let projectId: number | null | undefined = undefined
    let albumId: number | null | undefined = undefined
    let collectionKind: 'album' | 'project' | undefined = undefined

    if (collectionMode === 'project') {
      collectionKind = 'project'
      projectId = selectedProjectId
      if (projectId == null) {
        setError('Select a project to associate this photo with.')
        setSaving(false)
        return
      }
    } else if (collectionMode === 'album') {
      collectionKind = 'album'
      albumId = selectedAlbumId ?? uncategorizedAlbumId
      if (albumId == null) {
        setError('Select an album to associate this photo with.')
        setSaving(false)
        return
      }
    } else {
      // Uncategorized: server will fall back to the "Uncategorized" album.
      albumId = null
      collectionKind = undefined
    }

    try {
      const bulkFiles =
        !isEdit && allowMultipleFiles && filesList.length > 0
          ? filesList
          : !isEdit && file
            ? [file]
            : []

      if (!isEdit && allowMultipleFiles && bulkFiles.length > 0) {
        const fd = new FormData()
        for (const f of bulkFiles) {
          fd.append('files', f)
        }
        const prefix = title.trim()
        if (prefix) {
          fd.append('title', prefix)
        }
        fd.append('description', description.trim() ? description : '')
        fd.append('category', category.trim() || 'general')
        fd.append('takenAt', takenAt.trim())
        fd.append('tags', JSON.stringify(tags))
        if (collectionKind === 'project' && projectId != null) {
          fd.append('collectionKind', 'project')
          fd.append('projectId', String(projectId))
        } else if (collectionKind === 'album' && albumId != null) {
          fd.append('collectionKind', 'album')
          fd.append('albumId', String(albumId))
        }

        const res = await fetch('/api/admin/photos/upload-multiple', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        })
        const data = (await res.json().catch(() => ({}))) as {
          photos?: unknown[]
          errors?: { filename: string; error: string }[]
          error?: string
        }
        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload photos')
        }
        if (data.errors?.length) {
          const msg = data.errors.map((e) => `${e.filename}: ${e.error}`).join('; ')
          if (!data.photos?.length) {
            throw new Error(msg)
          }
          console.warn('Partial upload errors', msg)
        }
      } else if (!isEdit && file) {
        const form = new FormData()
        form.append('file', file)
        form.append('title', title)
        form.append('description', description.trim() ? description : '')
        form.append('category', category)
        form.append('takenAt', takenAt.trim())
        form.append('tags', JSON.stringify(tags))
        if (collectionKind === 'project' && projectId != null) {
          form.append('collectionKind', 'project')
          form.append('projectId', String(projectId))
        } else if (collectionKind === 'album' && albumId != null) {
          form.append('collectionKind', 'album')
          form.append('albumId', String(albumId))
        }

        const res = await fetch('/api/admin/photos/upload', {
          method: 'POST',
          body: form,
          credentials: 'include',
        })

        const data = (await res.json().catch(() => ({}))) as { photo?: ApiPhoto; error?: string }
        if (!res.ok || !data.photo) {
          throw new Error(data.error || 'Failed to save photo')
        }
      } else {
        const payload = {
          title,
          description: description.trim() ? description : null,
          url,
          category,
          takenAt: takenAt.trim() ? takenAt : null,
          tags,
          collectionKind,
          albumId,
          projectId,
        }

        const urlPath = isEdit ? `/api/admin/photos/${initialPhoto!.id}` : '/api/admin/photos'
        const method = isEdit ? 'PUT' : 'POST'

        const res = await fetch(urlPath, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })

        const data = (await res.json().catch(() => ({}))) as { photo?: ApiPhoto; error?: string }
        if (!res.ok || !data.photo) {
          throw new Error(data.error || 'Failed to save photo')
        }
      }

      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save photo')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialPhoto) return
    if (!window.confirm(`Delete photo "${initialPhoto.title}"? This cannot be undone.`)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/photos/${initialPhoto.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || data.ok !== true) {
        throw new Error(data.error || 'Failed to delete photo')
      }

      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photo')
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="photo-modal-title">
        <h2 id="photo-modal-title">
          {isEdit ? 'Edit photo' : allowMultipleFiles ? 'Add photos' : 'New photo'}
        </h2>
        <form className="settings-card" onSubmit={handleSubmit}>
          <label>
            {allowMultipleFiles && !isEdit ? 'Title prefix (optional)' : 'Title'}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required={isEdit || (!file && filesList.length === 0 && !url.trim())}
            />
            {allowMultipleFiles && !isEdit && (
              <span className="muted-text">
                When uploading multiple files, each photo uses its filename as title; if you enter a
                prefix here it is sent for server naming (optional).
              </span>
            )}
          </label>
          {!isEdit && (
            <label>
              {allowMultipleFiles ? 'Photo files' : 'Photo file'}
              <input
                type="file"
                accept="image/*"
                multiple={allowMultipleFiles}
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? [])
                  if (allowMultipleFiles) {
                    setFilesList(list)
                    setFile(null)
                  } else {
                    setFile(list[0] ?? null)
                    setFilesList([])
                  }
                }}
              />
              <span className="muted-text">
                Uploads are resized for the web; the original is kept for download.
                {allowMultipleFiles && ' You can select many images at once.'}
              </span>
            </label>
          )}
          <label>
            URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/photos/example.jpg or https://…"
              required={isEdit ? true : !file && !filesList.length}
            />
          </label>
          <label>
            Category
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="infra, places, people, etc."
              required
            />
          </label>
          <label>
            Taken at (optional, ISO date or text)
            <input
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              placeholder="2024-05-01 or free-form"
            />
          </label>
          <label>
            Description (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>
          <label>
            Tags (comma-separated)
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="rack, homelab, observability"
            />
          </label>
          <fieldset className="fieldset">
            <legend>Collection</legend>
            {lockCollection ? (
              <p className="muted-text" style={{ margin: 0 }}>
                {collectionMode === 'project' && selectedProjectId != null
                  ? 'Photos will be added to this project gallery.'
                  : collectionMode === 'album' && selectedAlbumId != null
                    ? 'Photos will be added to this album.'
                    : 'Photos will go to Uncategorized.'}
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <label className="checkbox-label">
                  <input
                    type="radio"
                    name="collectionMode"
                    checked={collectionMode === 'uncategorized'}
                    onChange={() => setCollectionMode('uncategorized')}
                  />
                  <span>Uncategorized</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="radio"
                    name="collectionMode"
                    checked={collectionMode === 'album'}
                    onChange={() => setCollectionMode('album')}
                  />
                  <span>Album</span>
                </label>

                {collectionMode === 'album' && (
                  <label className="select-label">
                    Album
                    <select
                      className="select"
                      value={selectedAlbumId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setSelectedAlbumId(val ? Number(val) : null)
                      }}
                    >
                      <option value="">Select an album</option>
                      {albums.map((album) => (
                        <option key={album.id} value={album.id}>
                          {album.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="checkbox-label">
                  <input
                    type="radio"
                    name="collectionMode"
                    checked={collectionMode === 'project'}
                    onChange={() => setCollectionMode('project')}
                  />
                  <span>Project</span>
                </label>

                {collectionMode === 'project' && (
                  <label className="select-label">
                    Project
                    {projectsLoading ? (
                      <div className="muted-text">Loading projects…</div>
                    ) : projects.length === 0 ? (
                      <div className="muted-text">No projects yet.</div>
                    ) : (
                      <select
                        className="select"
                        value={selectedProjectId ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setSelectedProjectId(val ? Number(val) : null)
                        }}
                      >
                        <option value="">Select a project</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                )}
              </div>
            )}
          </fieldset>
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
                Delete photo
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
              {saving
                ? 'Saving…'
                : isEdit
                  ? 'Save changes'
                  : allowMultipleFiles && filesList.length > 1
                    ? `Upload ${filesList.length} photos`
                    : 'Create photo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

