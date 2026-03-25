import type { Area } from 'react-easy-crop'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = src
  })
}

export async function cropImageToBlob(imageSrc: string, area: Area): Promise<Blob> {
  const img = await loadImage(imageSrc)
  const w = Math.max(1, Math.round(area.width))
  const h = Math.max(1, Math.round(area.height))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, w, h)
  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92)
  })
}

export type TextLayer = {
  id: string
  text: string
  /** 0–1 relative to image width */
  xn: number
  /** 0–1 relative to image height */
  yn: number
  /** font size as fraction of min(image width, height) */
  sizeRel: number
  color: string
  fontFamily: string
}

export async function drawTextLayersOnImage(imageSrc: string, layers: TextLayer[]): Promise<Blob> {
  const img = await loadImage(imageSrc)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0)
  const m = Math.min(w, h)
  for (const L of layers) {
    if (!L.text.trim()) continue
    const px = Math.max(8, Math.round(L.sizeRel * m))
    ctx.font = `${px}px ${L.fontFamily}`
    ctx.fillStyle = L.color
    ctx.textBaseline = 'top'
    ctx.fillText(L.text, L.xn * w, L.yn * h)
  }
  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92)
  })
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(blob)
  })
}
