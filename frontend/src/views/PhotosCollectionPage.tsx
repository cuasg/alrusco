import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PhotoEditModal } from '../ui/PhotoEditModal'
import {
  imageFilesFromDataTransfer,
  isProbablyFileDrag,
  uploadImageFilesBulk,
} from '../lib/photoBulkUpload'

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
}

type Album = {
  id: number
  name: string
  description: string | null
  createdAt: string
}

type ApiCollectionResponse = {
  photos: Photo[]
  coverPhotoIds: number[]
}

/** Photo shape expected by PhotoEditModal */
type EditPhoto = Photo & { albums: string[] }

export function PhotosCollectionPage() {
  const { user, loading: authLoading } = useAuth()
  const params = useParams()

  const kindParam = params.kind
  const idParam = params.id

  const kind = kindParam === 'project' ? 'project' : 'album'
  const collectionId = idParam ? Number(idParam) : NaN

  const [photos, setPhotos] = useState<Photo[]>([])
  const [coverPhotoIds, setCoverPhotoIds] = useState<number[]>([])
  const [collectionTitle, setCollectionTitle] = useState<string>('')
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editCoversOpen, setEditCoversOpen] = useState(false)
  const [selectedCoverIds, setSelectedCoverIds] = useState<number[]>([])

  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState<EditPhoto | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)

  const coverPreview = useMemo(() => {
    const photoById = new Map(photos.map((p) => [p.id, p]))
    return selectedCoverIds.map((id) => photoById.get(id)).filter(Boolean) as Photo[]
  }, [photos, selectedCoverIds])

  const viewerPhoto = viewerIndex != null ? photos[viewerIndex] ?? null : null

  const load = useCallback(async () => {
    if (!Number.isInteger(collectionId) || collectionId <= 0) {
      setError('Invalid collection id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [photosRes, collectionsRes] = await Promise.all([
        fetch(
          `/api/photos/collection?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(
            String(collectionId),
          )}`,
        ),
        fetch('/api/photos/collections'),
      ])

      if (!photosRes.ok) {
        throw new Error(`Failed to load collection: ${photosRes.status}`)
      }
      if (!collectionsRes.ok) {
        throw new Error(`Failed to load collections: ${collectionsRes.status}`)
      }

      const data = (await photosRes.json()) as ApiCollectionResponse
      const collectionsData = (await collectionsRes.json()) as {
        collections?: Array<{ kind: string; id: number; title: string }>
      }

      const tile = collectionsData.collections?.find((t) => t.kind === kind && t.id === collectionId)

      setCollectionTitle(tile?.title ?? '')
      setPhotos(data.photos ?? [])
      setCoverPhotoIds(data.coverPhotoIds ?? [])
      setSelectedCoverIds(data.coverPhotoIds ?? [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to load collection')
    } finally {
      setLoading(false)
    }
  }, [kind, collectionId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user || authLoading) return
    void (async () => {
      try {
        const res = await fetch('/api/photos/albums')
        if (!res.ok) return
        const data = (await res.json()) as { albums: Album[] }
        setAlbums(data.albums ?? [])
      } catch {
        /* ignore */
      }
    })()
  }, [user, authLoading])

  const closeViewer = useCallback(() => setViewerIndex(null), [])

  const goPrev = useCallback(() => {
    setViewerIndex((i) => {
      if (i == null || i <= 0) return i
      return i - 1
    })
  }, [])

  const goNext = useCallback(() => {
    setViewerIndex((i) => {
      if (i == null || i >= photos.length - 1) return i
      return i + 1
    })
  }, [photos.length])

  useEffect(() => {
    if (viewerIndex == null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeViewer()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerIndex, closeViewer, goPrev, goNext])

  useEffect(() => {
    if (viewerIndex == null) return
    document.body.classList.add('fb-lightbox-open')
    return () => document.body.classList.remove('fb-lightbox-open')
  }, [viewerIndex])

  async function saveCovers() {
    const ids = selectedCoverIds
    const res = await fetch('/api/admin/photos/collection-covers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        collectionKind: kind,
        collectionId,
        coverPhotoIds: ids,
      }),
    })

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error || `Failed to save covers: ${res.status}`)
    }
  }

  function toggleCoverId(photoId: number) {
    setSelectedCoverIds((prev) => {
      if (prev.includes(photoId)) return prev.filter((id) => id !== photoId)
      if (prev.length >= 4) return prev
      return [...prev, photoId]
    })
  }

  function openEdit(p: Photo) {
    setEditingPhoto({ ...p, albums: [] })
    setEditModalOpen(true)
    setViewerIndex(null)
  }

  const displayTitle = collectionTitle || (kind === 'project' ? 'Project' : 'Album')

  const handleCollectionDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDropActive(false)
      if (!user || authLoading) return
      const files = imageFilesFromDataTransfer(e.dataTransfer)
      if (!files.length) return
      setUploadBusy(true)
      setUploadNotice(null)
      setError(null)
      try {
        const target =
          kind === 'album'
            ? ({ collectionKind: 'album' as const, albumId: collectionId } as const)
            : ({ collectionKind: 'project' as const, projectId: collectionId } as const)
        const r = await uploadImageFilesBulk(files, { category: 'general', ...target })
        setUploadNotice(`Uploaded ${r.photos.length} photo${r.photos.length === 1 ? '' : 's'}.`)
        if (r.errors.length) {
          setUploadNotice((n) => `${n} ${r.errors.length} failed.`)
        }
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploadBusy(false)
      }
    },
    [user, authLoading, kind, collectionId, load],
  )

  return (
    <section className="page photos-collection-page fb-collection-page">
      <div className="fb-photos-shell">
        <header className="fb-collection-header">
          <div className="fb-collection-header-row">
            <Link to="/photos" className="fb-collection-back" aria-label="Back to photos">
              <span className="fb-collection-back-icon" aria-hidden="true">
                ‹
              </span>
              <span>Photos</span>
            </Link>
            {kind === 'project' && (
              <Link to="/projects" className="fb-collection-link-secondary">
                Projects
              </Link>
            )}
          </div>
          <div className="fb-collection-title-row">
            <div>
              <h1 className="fb-collection-title">{displayTitle}</h1>
              {!loading && !error && (
                <p className="fb-collection-count">
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                </p>
              )}
            </div>
            {user && !authLoading && (
              <div className="fb-collection-actions">
                <button
                  type="button"
                  className="fb-toolbar-btn fb-toolbar-btn--primary fb-toolbar-btn--compact"
                  onClick={() => {
                    setEditingPhoto(null)
                    setEditModalOpen(true)
                  }}
                >
                  Add photos
                </button>
                <button
                  type="button"
                  className="fb-toolbar-btn fb-toolbar-btn--compact"
                  onClick={() => {
                    setSelectedCoverIds(coverPhotoIds)
                    setEditCoversOpen(true)
                  }}
                >
                  Edit cover layout
                </button>
              </div>
            )}
          </div>
        </header>

        {uploadBusy && <p className="fb-photos-muted">Uploading…</p>}
        {uploadNotice && !uploadBusy && (
          <p className="fb-photos-upload-notice" role="status">
            {uploadNotice}
          </p>
        )}

        {loading && <p className="fb-photos-muted">Loading…</p>}
        {error && (
          <p className="error-text" role="status">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div
            className={`fb-collection-drop-host${dropActive && user && !authLoading ? ' fb-collection-drop-host--active' : ''}`}
            onDragOver={(e) => {
              if (!user || authLoading || !isProbablyFileDrag(e)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
              setDropActive(true)
            }}
            onDragEnter={(e) => {
              if (!user || authLoading || !isProbablyFileDrag(e)) return
              e.preventDefault()
              setDropActive(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropActive(false)
              }
            }}
            onDrop={user && !authLoading ? handleCollectionDrop : undefined}
          >
            {!loading && !error && photos.length === 0 && (
              <div className="fb-photos-empty fb-photos-empty--droppable">
                <p className="fb-photos-empty-title">
                  No photos in this {kind === 'project' ? 'gallery' : 'album'} yet
                </p>
                {user && !authLoading && (
                  <p className="fb-photos-muted">
                    Drop image files here or use <strong>Add photos</strong>.
                  </p>
                )}
              </div>
            )}

            {!loading && !error && photos.length > 0 && editCoversOpen && user && !authLoading && (
              <p className="fb-cover-mode-hint" role="status">
                Tap photos to pick up to 4 cover images, then press Save in the dialog.
              </p>
            )}

            {!loading && !error && photos.length > 0 && (
              <div className="fb-photo-mosaic" role="list">
                {photos.map((p, index) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`fb-photo-cell ${editCoversOpen && user ? 'fb-photo-cell--select-mode' : ''} ${selectedCoverIds.includes(p.id) ? 'fb-photo-cell--selected' : ''}`}
                    onClick={() => {
                      if (editCoversOpen && user) {
                        toggleCoverId(p.id)
                        return
                      }
                      setViewerIndex(index)
                    }}
                    aria-label={editCoversOpen ? `Toggle cover: ${p.title}` : `View ${p.title}`}
                  >
                    <img src={p.url} alt="" loading="lazy" />
                    {editCoversOpen && user && (
                      <span className="fb-photo-cell-check" aria-hidden="true">
                        {selectedCoverIds.includes(p.id) ? '✓' : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {user && !authLoading && !loading && !error && photos.length > 0 && (
              <p className="fb-collection-drop-footer fb-photos-muted">
                Drag and drop images anywhere in this area to add them to this{' '}
                {kind === 'project' ? 'gallery' : 'album'}.
              </p>
            )}
          </div>
        )}
      </div>

      {viewerPhoto && (
        <div
          className="fb-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <button
            type="button"
            className="fb-lightbox-backdrop"
            aria-label="Close"
            onClick={closeViewer}
          />
          <div className="fb-lightbox-content">
            <div className="fb-lightbox-topbar">
              <button type="button" className="fb-lightbox-icon-btn" onClick={closeViewer} aria-label="Close">
                ✕
              </button>
              <span className="fb-lightbox-counter">
                {viewerIndex! + 1} / {photos.length}
              </span>
              {user && !authLoading && (
                <button
                  type="button"
                  className="fb-lightbox-icon-btn"
                  onClick={() => openEdit(viewerPhoto)}
                >
                  Edit
                </button>
              )}
            </div>
            <div className="fb-lightbox-stage">
              {viewerIndex! > 0 && (
                <button
                  type="button"
                  className="fb-lightbox-nav fb-lightbox-nav--prev"
                  onClick={goPrev}
                  aria-label="Previous photo"
                >
                  ‹
                </button>
              )}
              <div className="fb-lightbox-img-wrap">
                <img src={viewerPhoto.url} alt={viewerPhoto.title} className="fb-lightbox-img" />
              </div>
              {viewerIndex! < photos.length - 1 && (
                <button
                  type="button"
                  className="fb-lightbox-nav fb-lightbox-nav--next"
                  onClick={goNext}
                  aria-label="Next photo"
                >
                  ›
                </button>
              )}
            </div>
            <div className="fb-lightbox-caption">
              <div className="fb-lightbox-title">{viewerPhoto.title}</div>
              {viewerPhoto.description && (
                <p className="fb-lightbox-desc">{viewerPhoto.description}</p>
              )}
              {viewerPhoto.tags.length > 0 && (
                <div className="fb-lightbox-tags">
                  {viewerPhoto.tags.map((t) => (
                    <span key={t} className="fb-lightbox-tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {viewerPhoto.originalUrl && (
                <a
                  href={viewerPhoto.originalUrl}
                  download
                  className="fb-lightbox-download"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download original
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {user && !authLoading && (
        <PhotoEditModal
          open={editModalOpen}
          initialPhoto={editingPhoto}
          albums={albums}
          defaultAlbumId={kind === 'album' ? collectionId : null}
          defaultProjectId={kind === 'project' ? collectionId : null}
          lockCollection={!editingPhoto}
          initialCollection={
            editingPhoto
              ? kind === 'project'
                ? { kind: 'project', projectId: collectionId }
                : { kind: 'album', albumId: collectionId }
              : undefined
          }
          allowMultipleFiles={!editingPhoto}
          onClose={() => {
            setEditModalOpen(false)
            setEditingPhoto(null)
          }}
          onChanged={() => {
            setEditModalOpen(false)
            setEditingPhoto(null)
            void load()
          }}
        />
      )}

      {user && !authLoading && editCoversOpen && (
        <div className="modal-backdrop fb-covers-modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" aria-labelledby="covers-modal-title">
            <h2 id="covers-modal-title">Cover photos (up to 4)</h2>
            <p className="fb-photos-muted" style={{ marginTop: 0 }}>
              Tap photos in the grid to choose which appear on the album card. Then save here.
            </p>

            <div className="covers-preview-grid">
              {Array.from({ length: 4 }).map((_, idx) => {
                const photo = coverPreview[idx]
                return (
                  <div key={idx} className="covers-preview-slot">
                    <div className="covers-preview-slot-label">Slot {idx + 1}</div>
                    {photo ? <img src={photo.url} alt={photo.title} loading="lazy" /> : null}
                  </div>
                )
              })}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setSelectedCoverIds(coverPhotoIds)
                  setEditCoversOpen(false)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await saveCovers()
                    await load()
                    setEditCoversOpen(false)
                  } catch (err) {
                    console.error(err)
                    setError(err instanceof Error ? err.message : 'Failed to save covers')
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
