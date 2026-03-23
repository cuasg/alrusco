import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PhotoEditModal } from '../ui/PhotoEditModal'
import { AlbumEditModal } from '../ui/AlbumEditModal'
import { FbAlbumCollage } from '../ui/FbAlbumCollage'
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
  albums: string[]
}

type Album = {
  id: number
  name: string
  description: string | null
  createdAt: string
}

type CollagePhoto = {
  id: number
  url: string
  title: string
}

type AlbumCollectionTile = {
  kind: 'album'
  id: number
  title: string
  photoCount: number
  collagePhotos: CollagePhoto[]
  coverEditable: boolean
}

type ProjectCollectionTile = {
  kind: 'project'
  id: number
  title: string
  photoCount: number
  collagePhotos: CollagePhoto[]
  coverEditable: boolean
}

type CollectionTile = AlbumCollectionTile | ProjectCollectionTile

export function PhotosPage() {
  const { user, loading: authLoading } = useAuth()

  const [collections, setCollections] = useState<CollectionTile[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null)

  const [albumModalOpen, setAlbumModalOpen] = useState(false)
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null)

  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [dropCommon, setDropCommon] = useState<'uncategorized' | 'newAlbum' | null>(null)
  const [dropAlbumId, setDropAlbumId] = useState<number | null>(null)
  const [dropProjectId, setDropProjectId] = useState<number | null>(null)

  const albumTiles = useMemo(
    () => collections.filter((c): c is AlbumCollectionTile => c.kind === 'album'),
    [collections],
  )
  const projectTiles = useMemo(
    () => collections.filter((c): c is ProjectCollectionTile => c.kind === 'project'),
    [collections],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [collectionsRes, albumsRes] = await Promise.all([
        fetch('/api/photos/collections'),
        fetch('/api/photos/albums'),
      ])

      if (!collectionsRes.ok) {
        throw new Error(`Failed to load collections: ${collectionsRes.status}`)
      }
      if (!albumsRes.ok) {
        throw new Error(`Failed to load albums: ${albumsRes.status}`)
      }

      const collectionsData = (await collectionsRes.json()) as { collections: CollectionTile[] }
      const albumsData = (await albumsRes.json()) as { albums: Album[] }

      setCollections(collectionsData.collections ?? [])
      setAlbums(albumsData.albums ?? [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to load collections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const clearDropHighlights = useCallback(() => {
    setDropCommon(null)
    setDropAlbumId(null)
    setDropProjectId(null)
  }, [])

  const runBulkUpload = useCallback(
    async (
      files: File[],
      target: Parameters<typeof uploadImageFilesBulk>[1],
      successNote?: string,
    ) => {
      if (!files.length) return
      setUploadBusy(true)
      setUploadNotice(null)
      setError(null)
      try {
        const r = await uploadImageFilesBulk(files, { category: 'general', ...target })
        let msg =
          successNote ??
          `Uploaded ${r.photos.length} photo${r.photos.length === 1 ? '' : 's'}.`
        if (r.errors.length) {
          msg += ` ${r.errors.length} file(s) failed.`
        }
        setUploadNotice(msg)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploadBusy(false)
        clearDropHighlights()
      }
    },
    [load, clearDropHighlights],
  )

  const createAlbumAndUpload = useCallback(
    async (files: File[]) => {
      const name = window.prompt('New album name?', '')
      if (name == null) {
        clearDropHighlights()
        return
      }
      const trimmed = name.trim()
      if (!trimmed) {
        clearDropHighlights()
        return
      }
      setUploadBusy(true)
      setUploadNotice(null)
      setError(null)
      try {
        const res = await fetch('/api/admin/albums', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: trimmed, description: null }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          album?: { id: number }
          error?: string
        }
        if (!res.ok || !data.album) {
          throw new Error(data.error || 'Could not create album')
        }
        await runBulkUpload(
          files,
          { collectionKind: 'album', albumId: data.album.id },
          `Created album “${trimmed}” and uploaded photos.`,
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed')
        setUploadBusy(false)
        clearDropHighlights()
      }
    },
    [runBulkUpload, clearDropHighlights],
  )

  function handlePhotoChanged() {
    setPhotoModalOpen(false)
    setEditingPhoto(null)
    void load()
  }

  function handleAlbumChanged() {
    setAlbumModalOpen(false)
    setEditingAlbum(null)
    void load()
  }

  function handleShellDragOver(e: React.DragEvent) {
    if (!user || authLoading || !isProbablyFileDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function renderAlbumTile(c: AlbumCollectionTile) {
    const active = dropAlbumId === c.id
    return (
      <div
        key={`album:${c.id}`}
        className={`fb-album-drop-wrap${active ? ' fb-album-drop-wrap--active' : ''}`}
        onDragOver={(e) => {
          if (!user || authLoading || !isProbablyFileDrag(e)) return
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'copy'
          setDropAlbumId(c.id)
          setDropProjectId(null)
          setDropCommon(null)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropAlbumId((id) => (id === c.id ? null : id))
          }
        }}
        onDrop={(e) => {
          if (!user || authLoading) return
          e.preventDefault()
          e.stopPropagation()
          const files = imageFilesFromDataTransfer(e.dataTransfer)
          clearDropHighlights()
          if (files.length) void runBulkUpload(files, { collectionKind: 'album', albumId: c.id })
        }}
      >
        <Link
          to={`/photos/collection/${c.kind}/${c.id}`}
          className="fb-album-card"
          aria-label={`${c.title}, ${c.photoCount} photos`}
        >
          <FbAlbumCollage photos={c.collagePhotos} />
          <div className="fb-album-card-footer">
            <div className="fb-album-card-title">{c.title}</div>
            <div className="fb-album-card-meta">
              {c.photoCount} {c.photoCount === 1 ? 'photo' : 'photos'}
            </div>
          </div>
        </Link>
      </div>
    )
  }

  function renderProjectTile(c: ProjectCollectionTile) {
    const active = dropProjectId === c.id
    return (
      <div
        key={`project:${c.id}`}
        className={`fb-album-drop-wrap${active ? ' fb-album-drop-wrap--active' : ''}`}
        onDragOver={(e) => {
          if (!user || authLoading || !isProbablyFileDrag(e)) return
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'copy'
          setDropProjectId(c.id)
          setDropAlbumId(null)
          setDropCommon(null)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropProjectId((id) => (id === c.id ? null : id))
          }
        }}
        onDrop={(e) => {
          if (!user || authLoading) return
          e.preventDefault()
          e.stopPropagation()
          const files = imageFilesFromDataTransfer(e.dataTransfer)
          clearDropHighlights()
          if (files.length) {
            void runBulkUpload(files, { collectionKind: 'project', projectId: c.id })
          }
        }}
      >
        <Link
          to={`/photos/collection/${c.kind}/${c.id}`}
          className="fb-album-card"
          aria-label={`${c.title}, ${c.photoCount} photos`}
        >
          <FbAlbumCollage photos={c.collagePhotos} />
          <div className="fb-album-card-footer">
            <div className="fb-album-card-title">{c.title}</div>
            <div className="fb-album-card-meta">
              {c.photoCount} {c.photoCount === 1 ? 'photo' : 'photos'}
              <span className="fb-album-badge">Project</span>
            </div>
          </div>
        </Link>
      </div>
    )
  }

  return (
    <section
      className="page photos-page fb-photos-page"
      onDragOver={handleShellDragOver}
      onDrop={(e) => {
        if (!user || authLoading) return
        if (dropAlbumId != null || dropProjectId != null || dropCommon != null) return
        const files = imageFilesFromDataTransfer(e.dataTransfer)
        if (!files.length) return
        e.preventDefault()
        clearDropHighlights()
        void runBulkUpload(files, {})
      }}
    >
      <div className="fb-photos-shell">
        <header className="fb-photos-header">
          <div className="fb-photos-header-text">
            <h1 className="fb-photos-title">Photos</h1>
            <p className="fb-photos-subtitle">Your albums and project galleries</p>
          </div>
          {user && !authLoading && (
            <div className="fb-photos-toolbar">
              <button
                type="button"
                className="fb-toolbar-btn fb-toolbar-btn--primary"
                onClick={() => {
                  setEditingPhoto(null)
                  setPhotoModalOpen(true)
                }}
              >
                Add photos
              </button>
              <button
                type="button"
                className="fb-toolbar-btn"
                onClick={() => {
                  setEditingAlbum(null)
                  setAlbumModalOpen(true)
                }}
              >
                Albums
              </button>
            </div>
          )}
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

        {user && !authLoading && !loading && (
          <div className="fb-photos-drop-row" onDragOver={handleShellDragOver}>
            <div
              className={`fb-drop-panel${dropCommon === 'uncategorized' ? ' fb-drop-panel--active' : ''}`}
              onDragOver={(e) => {
                if (!isProbablyFileDrag(e)) return
                e.preventDefault()
                setDropCommon('uncategorized')
                setDropAlbumId(null)
                setDropProjectId(null)
              }}
              onDragLeave={() => setDropCommon((z) => (z === 'uncategorized' ? null : z))}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const files = imageFilesFromDataTransfer(e.dataTransfer)
                setDropCommon(null)
                if (files.length) void runBulkUpload(files, {}, 'Added to Uncategorized.')
              }}
            >
              <strong>Uncategorized</strong>
              <span>Drop images here (not in an album)</span>
            </div>
            <div
              className={`fb-drop-panel${dropCommon === 'newAlbum' ? ' fb-drop-panel--active' : ''}`}
              onDragOver={(e) => {
                if (!isProbablyFileDrag(e)) return
                e.preventDefault()
                setDropCommon('newAlbum')
                setDropAlbumId(null)
                setDropProjectId(null)
              }}
              onDragLeave={() => setDropCommon((z) => (z === 'newAlbum' ? null : z))}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const files = imageFilesFromDataTransfer(e.dataTransfer)
                setDropCommon(null)
                if (files.length) void createAlbumAndUpload(files)
              }}
            >
              <strong>New album</strong>
              <span>Drop images — you’ll name the album</span>
            </div>
          </div>
        )}

        {!loading && !error && collections.length === 0 && (
          <div className="fb-photos-empty">
            <p className="fb-photos-empty-title">No photos yet</p>
            <p className="fb-photos-muted">Add a photo or create an album to get started.</p>
          </div>
        )}

        {!loading && !error && albumTiles.length > 0 && (
          <section className="fb-photos-section" aria-labelledby="fb-albums-heading">
            <h2 id="fb-albums-heading" className="fb-photos-section-title">
              Albums
            </h2>
            <p className="fb-photos-muted fb-photos-drop-hint">
              Drag images onto an album to add them there.
            </p>
            <div className="fb-album-grid">{albumTiles.map(renderAlbumTile)}</div>
          </section>
        )}

        {!loading && !error && projectTiles.length > 0 && (
          <section className="fb-photos-section" aria-labelledby="fb-projects-heading">
            <h2 id="fb-projects-heading" className="fb-photos-section-title">
              Project galleries
            </h2>
            <p className="fb-photos-muted fb-photos-drop-hint">
              Drag images onto a project to add to that gallery.
            </p>
            <div className="fb-album-grid">{projectTiles.map(renderProjectTile)}</div>
          </section>
        )}

        {user && !authLoading && (
          <>
            <PhotoEditModal
              open={photoModalOpen}
              onClose={() => {
                setPhotoModalOpen(false)
                setEditingPhoto(null)
              }}
              initialPhoto={editingPhoto}
              albums={albums}
              allowMultipleFiles={!editingPhoto}
              onChanged={handlePhotoChanged}
            />
            <AlbumEditModal
              open={albumModalOpen}
              onClose={() => {
                setAlbumModalOpen(false)
                setEditingAlbum(null)
              }}
              initialAlbum={editingAlbum}
              onChanged={handleAlbumChanged}
            />
          </>
        )}
      </div>
    </section>
  )
}
