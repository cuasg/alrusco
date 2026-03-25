import { useCallback, useEffect, useMemo, useState } from 'react'
import Cropper, { type Area, type Point, type MediaSize } from 'react-easy-crop'
import {
  blobToDataUrl,
  cropImageToBlob,
  drawTextLayersOnImage,
  type TextLayer,
} from '../lib/imageEdit'

const MAX_HISTORY = 18

type AspectPresetId =
  | 'original'
  | '1-1'
  | '4-3'
  | '3-4'
  | '16-9'
  | '9-16'
  | '3-2'
  | '2-3'
  | 'custom'

const ASPECT_PRESET_ROWS: { id: AspectPresetId; label: string; ratio?: number }[] = [
  { id: 'original', label: 'Original' },
  { id: '1-1', label: '1:1', ratio: 1 },
  { id: '4-3', label: '4:3', ratio: 4 / 3 },
  { id: '3-4', label: '3:4', ratio: 3 / 4 },
  { id: '16-9', label: '16:9', ratio: 16 / 9 },
  { id: '9-16', label: '9:16', ratio: 9 / 16 },
  { id: '3-2', label: '3:2', ratio: 3 / 2 },
  { id: '2-3', label: '2:3', ratio: 2 / 3 },
  { id: 'custom', label: 'Custom' },
]

type Snap = {
  imageSrc: string
  layers: TextLayer[]
}

const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: 'system-ui, sans-serif', label: 'System' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: '"Courier New", monospace', label: 'Courier' },
]

function newLayer(): TextLayer {
  return {
    id: crypto.randomUUID(),
    text: 'Text',
    xn: 0.08,
    yn: 0.08,
    sizeRel: 0.045,
    color: '#ffffff',
    fontFamily: FONT_OPTIONS[0]!.value,
  }
}

type Props = {
  open: boolean
  photoId: number
  photoUrl: string
  photoTitle: string
  onClose: () => void
  onSaved: () => void
}

export function PhotoImageEditModal({
  open,
  photoId,
  photoUrl,
  photoTitle,
  onClose,
  onSaved,
}: Props) {
  const [hist, setHist] = useState<{ stack: Snap[]; i: number }>({ stack: [], i: 0 })
  const [tab, setTab] = useState<'crop' | 'text'>('crop')
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [aspectPreset, setAspectPreset] = useState<AspectPresetId>('original')
  const [customAspectW, setCustomAspectW] = useState(4)
  const [customAspectH, setCustomAspectH] = useState(3)
  const [mediaNatural, setMediaNatural] = useState<{ w: number; h: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dupTitle, setDupTitle] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const current = hist.stack[hist.i] ?? null

  const resetFromPhoto = useCallback(async () => {
    setLoadError(null)
    setSaveError(null)
    setTab('crop')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setAspectPreset('original')
    setMediaNatural(null)
    setSelectedId(null)
    setDupTitle(`${photoTitle} (edited)`.slice(0, 200))
    try {
      const abs = photoUrl.startsWith('http') ? photoUrl : `${window.location.origin}${photoUrl}`
      const res = await fetch(abs, { credentials: 'include' })
      if (!res.ok) throw new Error(`Load failed (${res.status})`)
      const blob = await res.blob()
      const imageSrc = await blobToDataUrl(blob)
      const initial: Snap = { imageSrc, layers: [] }
      setHist({ stack: [initial], i: 0 })
    } catch (e) {
      setHist({ stack: [], i: 0 })
      setLoadError(e instanceof Error ? e.message : 'Could not load image')
    }
  }, [photoUrl, photoTitle])

  useEffect(() => {
    if (!open) return
    void resetFromPhoto()
  }, [open, resetFromPhoto])

  const commit = useCallback((next: Snap) => {
    setHist((s) => {
      const base = s.stack.slice(0, s.i + 1)
      const stack = [...base, next].slice(-MAX_HISTORY)
      return { stack, i: stack.length - 1 }
    })
  }, [])

  const replaceCurrent = useCallback((snap: Snap) => {
    setHist((s) => {
      const stack = s.stack.slice()
      stack[s.i] = snap
      return { stack, i: s.i }
    })
  }, [])

  const undo = useCallback(() => {
    setHist((s) => ({ ...s, i: Math.max(0, s.i - 1) }))
  }, [])

  const redo = useCallback(() => {
    setHist((s) => ({ ...s, i: Math.min(s.stack.length - 1, s.i + 1) }))
  }, [])

  const canUndo = hist.i > 0
  const canRedo = hist.i < hist.stack.length - 1

  const cropAspect = useMemo(() => {
    if (aspectPreset === 'original') {
      if (mediaNatural && mediaNatural.h > 0) {
        return mediaNatural.w / mediaNatural.h
      }
      return 4 / 3
    }
    if (aspectPreset === 'custom') {
      const w = Math.max(1, Math.min(100, Math.round(customAspectW)))
      const h = Math.max(1, Math.min(100, Math.round(customAspectH)))
      return w / h
    }
    const row = ASPECT_PRESET_ROWS.find((r) => r.id === aspectPreset)
    return row?.ratio ?? 4 / 3
  }, [aspectPreset, customAspectW, customAspectH, mediaNatural])

  useEffect(() => {
    setCrop({ x: 0, y: 0 })
    setCroppedAreaPixels(null)
  }, [cropAspect, current?.imageSrc])

  const onMediaLoaded = useCallback((ms: MediaSize) => {
    setMediaNatural({ w: ms.naturalWidth, h: ms.naturalHeight })
  }, [])

  const onCropComplete = useCallback((_c: Area, px: Area) => {
    setCroppedAreaPixels(px)
  }, [])

  const applyCrop = useCallback(async () => {
    if (!current || !croppedAreaPixels) return
    setBusy(true)
    setSaveError(null)
    try {
      const blob = await cropImageToBlob(current.imageSrc, croppedAreaPixels)
      const imageSrc = await blobToDataUrl(blob)
      commit({ imageSrc, layers: [] })
      setCroppedAreaPixels(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Crop failed')
    } finally {
      setBusy(false)
    }
  }, [commit, croppedAreaPixels, current])

  const applyTextToImage = useCallback(async () => {
    if (!current || !current.layers.length) return
    setBusy(true)
    setSaveError(null)
    try {
      const blob = await drawTextLayersOnImage(current.imageSrc, current.layers)
      const imageSrc = await blobToDataUrl(blob)
      commit({ imageSrc, layers: [] })
      setSelectedId(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not apply text')
    } finally {
      setBusy(false)
    }
  }, [commit, current])

  const addLayer = useCallback(() => {
    if (!current) return
    const L = newLayer()
    const next: Snap = { imageSrc: current.imageSrc, layers: [...current.layers, L] }
    commit(next)
    setSelectedId(L.id)
  }, [commit, current])

  const updateLayer = useCallback(
    (id: string, patch: Partial<TextLayer>) => {
      if (!current) return
      const layers = current.layers.map((l) => (l.id === id ? { ...l, ...patch } : l))
      replaceCurrent({ imageSrc: current.imageSrc, layers })
    },
    [current, replaceCurrent],
  )

  const removeLayer = useCallback(
    (id: string) => {
      if (!current) return
      const layers = current.layers.filter((l) => l.id !== id)
      commit({ imageSrc: current.imageSrc, layers })
      setSelectedId((s) => (s === id ? null : s))
    },
    [commit, current],
  )

  const selected = useMemo(
    () => current?.layers.find((l) => l.id === selectedId) ?? null,
    [current, selectedId],
  )

  const buildOutputBlob = useCallback(async (): Promise<Blob> => {
    if (!current) throw new Error('No image')
    if (current.layers.length) {
      return await drawTextLayersOnImage(current.imageSrc, current.layers)
    }
    const res = await fetch(current.imageSrc)
    return await res.blob()
  }, [current])

  const saveReplace = useCallback(async () => {
    if (!current) return
    setBusy(true)
    setSaveError(null)
    try {
      const blob = await buildOutputBlob()
      const fd = new FormData()
      fd.append('file', blob, 'edited.jpg')
      const res = await fetch(`/api/admin/photos/${photoId}/replace-image`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`)
      onSaved()
      onClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }, [buildOutputBlob, current, onClose, onSaved, photoId])

  const saveDuplicate = useCallback(async () => {
    if (!current) return
    setBusy(true)
    setSaveError(null)
    try {
      const blob = await buildOutputBlob()
      const fd = new FormData()
      fd.append('file', blob, 'edited.jpg')
      fd.append('title', dupTitle.trim() || `${photoTitle} (edited)`.slice(0, 200))
      const res = await fetch(`/api/admin/photos/${photoId}/duplicate-with-image`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`)
      onSaved()
      onClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }, [buildOutputBlob, current, dupTitle, onClose, onSaved, photoId, photoTitle])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal photo-image-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-image-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="photo-image-edit-title">Edit image</h2>
        {loadError && (
          <>
            <p className="error-text" role="alert">
              {loadError}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
        {saveError && (
          <p className="error-text" role="alert">
            {saveError}
          </p>
        )}
        {current && !loadError && (
          <>
            <div className="photo-image-edit-toolbar">
              <div className="photo-image-edit-undo">
                <button type="button" className="btn btn-ghost" disabled={!canUndo || busy} onClick={undo}>
                  Undo
                </button>
                <button type="button" className="btn btn-ghost" disabled={!canRedo || busy} onClick={redo}>
                  Redo
                </button>
              </div>
              <div className="photo-image-edit-tabs">
                <button
                  type="button"
                  className={`portfolio-edit-tab${tab === 'crop' ? ' portfolio-edit-tab--active' : ''}`}
                  onClick={() => setTab('crop')}
                >
                  Crop
                </button>
                <button
                  type="button"
                  className={`portfolio-edit-tab${tab === 'text' ? ' portfolio-edit-tab--active' : ''}`}
                  onClick={() => setTab('text')}
                >
                  Text
                </button>
              </div>
            </div>

            {tab === 'crop' && (
              <div className="photo-image-crop-wrap">
                <div className="photo-image-aspect-row" role="group" aria-label="Crop aspect ratio">
                  {ASPECT_PRESET_ROWS.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`photo-image-aspect-btn${aspectPreset === row.id ? ' photo-image-aspect-btn--active' : ''}`}
                      onClick={() => setAspectPreset(row.id)}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
                {aspectPreset === 'custom' && (
                  <div className="photo-image-custom-aspect">
                    <label>
                      Width
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={customAspectW}
                        onChange={(e) => setCustomAspectW(Number(e.target.value) || 1)}
                      />
                    </label>
                    <span className="photo-image-custom-aspect-colon" aria-hidden="true">
                      :
                    </span>
                    <label>
                      Height
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={customAspectH}
                        onChange={(e) => setCustomAspectH(Number(e.target.value) || 1)}
                      />
                    </label>
                    <span className="photo-image-custom-aspect-hint">e.g. 21 and 9 for ultrawide</span>
                  </div>
                )}
                <div className="photo-image-crop-stage">
                  <Cropper
                    image={current.imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={cropAspect}
                    rotation={0}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    onMediaLoaded={onMediaLoaded}
                  />
                </div>
                <label className="photo-image-zoom-label">
                  Zoom
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary photo-image-apply-crop"
                  disabled={busy || !croppedAreaPixels}
                  onClick={() => void applyCrop()}
                >
                  Apply crop
                </button>
              </div>
            )}

            {tab === 'text' && (
              <div className="photo-image-text-panel">
                <div className="photo-image-preview-wrap">
                  <img src={current.imageSrc} alt="" className="photo-image-preview-img" />
                  <div className="photo-image-text-overlay">
                    {current.layers.map((L) => (
                      <button
                        key={L.id}
                        type="button"
                        className={`photo-image-text-layer${selectedId === L.id ? ' photo-image-text-layer--selected' : ''}`}
                        style={{
                          left: `${L.xn * 100}%`,
                          top: `${L.yn * 100}%`,
                          color: L.color,
                          fontFamily: L.fontFamily,
                          fontSize: `${Math.max(12, Math.round(L.sizeRel * 280))}px`,
                        }}
                        onClick={() => setSelectedId(L.id)}
                      >
                        {L.text || '…'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="photo-image-text-controls">
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={addLayer}>
                    Add text
                  </button>
                  {selected && (
                    <>
                      <label>
                        Text
                        <input
                          value={selected.text}
                          onChange={(e) => updateLayer(selected.id, { text: e.target.value })}
                        />
                      </label>
                      <label>
                        Color
                        <input
                          type="color"
                          value={selected.color.length === 7 ? selected.color : '#ffffff'}
                          onChange={(e) => updateLayer(selected.id, { color: e.target.value })}
                        />
                      </label>
                      <label>
                        Size
                        <input
                          type="range"
                          min={0.02}
                          max={0.14}
                          step={0.005}
                          value={selected.sizeRel}
                          onChange={(e) =>
                            updateLayer(selected.id, { sizeRel: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Font
                        <select
                          value={selected.fontFamily}
                          onChange={(e) => updateLayer(selected.id, { fontFamily: e.target.value })}
                        >
                          {FONT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Horizontal (0–100%)
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={0.5}
                          value={selected.xn * 100}
                          onChange={(e) =>
                            updateLayer(selected.id, { xn: Number(e.target.value) / 100 })
                          }
                        />
                      </label>
                      <label>
                        Vertical (0–100%)
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={0.5}
                          value={selected.yn * 100}
                          onChange={(e) =>
                            updateLayer(selected.id, { yn: Number(e.target.value) / 100 })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => removeLayer(selected.id)}
                      >
                        Remove text
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !current.layers.length}
                    onClick={() => void applyTextToImage()}
                  >
                    Bake text into image
                  </button>
                </div>
              </div>
            )}

            <div className="photo-image-save-block">
              <label className="photo-image-dup-title">
                Title when saving as new
                <input value={dupTitle} onChange={(e) => setDupTitle(e.target.value)} maxLength={200} />
              </label>
              <div className="modal-actions photo-image-save-actions">
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void saveDuplicate()}>
                  Save as new photo
                </button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveReplace()}>
                  Replace current
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
