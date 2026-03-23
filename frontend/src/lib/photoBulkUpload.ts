export type BulkUploadTarget =
  | { collectionKind?: undefined; albumId?: undefined; projectId?: undefined }
  | { collectionKind: 'album'; albumId: number }
  | { collectionKind: 'project'; projectId: number }

export async function uploadImageFilesBulk(
  files: File[],
  options: BulkUploadTarget & {
    category?: string
    tags?: string[]
  },
): Promise<{ photos: { id: number; title: string }[]; errors: { filename: string; error: string }[] }> {
  const imgs = files.filter((f) => f.type.startsWith('image/'))
  if (!imgs.length) {
    throw new Error('No image files to upload')
  }

  const fd = new FormData()
  for (const f of imgs) {
    fd.append('files', f)
  }
  fd.append('category', (options.category ?? 'general').trim() || 'general')
  fd.append('tags', JSON.stringify(options.tags ?? []))

  if (options.collectionKind === 'album' && options.albumId != null) {
    fd.append('collectionKind', 'album')
    fd.append('albumId', String(options.albumId))
  } else if (options.collectionKind === 'project' && options.projectId != null) {
    fd.append('collectionKind', 'project')
    fd.append('projectId', String(options.projectId))
  }

  const res = await fetch('/api/admin/photos/upload-multiple', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })

  const data = (await res.json().catch(() => ({}))) as {
    photos?: { id: number; title: string }[]
    errors?: { filename: string; error: string }[]
    error?: string
  }

  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`)
  }

  return {
    photos: data.photos ?? [],
    errors: data.errors ?? [],
  }
}

export function imageFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt?.files?.length) return []
  return Array.from(dt.files).filter((f) => f.type.startsWith('image/'))
}

export function isProbablyFileDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files')
}
