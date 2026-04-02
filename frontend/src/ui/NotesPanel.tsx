import { useCallback, useEffect, useRef, useState } from 'react'

export type SavedNote = {
  id: string
  title: string
  body: string
  updatedAt: string
}

type Props = {
  className?: string
}

export function NotesPanel({ className }: Props) {
  const [items, setItems] = useState<SavedNote[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<number | null>(null)
  const pendingRef = useRef<{ id: string; title: string; body: string } | null>(null)

  const selected = selectedId ? items.find((n) => n.id === selectedId) : undefined

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/notes', { credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as { items?: SavedNote[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load notes')
      const next = Array.isArray(data.items) ? data.items : []
      setItems(next)
      setSelectedId((cur) => {
        if (cur && next.some((n) => n.id === cur)) return cur
        return next[0]?.id ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notes')
      setItems([])
      setSelectedId(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setTitle('')
      setBody('')
      return
    }
    const n = items.find((x) => x.id === selectedId)
    if (n) {
      setTitle(n.title)
      setBody(n.body)
    }
  }, [selectedId, items])

  function scheduleSave(noteId: string, nextTitle: string, nextBody: string) {
    pendingRef.current = { id: noteId, title: nextTitle, body: nextBody }
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null
      const p = pendingRef.current
      if (!p || p.id !== noteId) return
      void persist(noteId, p.title, p.body)
    }, 450)
  }

  async function flushPending() {
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const p = pendingRef.current
    if (!p) return
    pendingRef.current = null
    await persist(p.id, p.title, p.body)
  }

  async function persist(noteId: string, nextTitle: string, nextBody: string) {
    setSaveState('saving')
    setError(null)
    try {
      const res = await fetch(`/api/admin/notes/${encodeURIComponent(noteId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: nextTitle, body: nextBody }),
      })
      const data = (await res.json().catch(() => ({}))) as { item?: SavedNote; error?: string }
      if (!res.ok) throw new Error(data.error || 'Save failed')
      const item = data.item
      if (item) {
        setItems((prev) => prev.map((x) => (x.id === item.id ? item : x)))
      }
      setSaveState('saved')
      window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1600)
    } catch (e) {
      setSaveState('error')
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
    }
  }, [])

  async function selectNote(nextId: string) {
    if (nextId === selectedId) return
    await flushPending()
    setSelectedId(nextId)
  }

  async function handleNew() {
    await flushPending()
    setError(null)
    try {
      const res = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: 'Untitled', body: '' }),
      })
      const data = (await res.json().catch(() => ({}))) as { item?: SavedNote; error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not create note')
      const item = data.item
      if (!item) throw new Error('Invalid response')
      setItems((prev) => [item, ...prev])
      setSelectedId(item.id)
      setTitle(item.title)
      setBody(item.body)
      setSaveState('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create note')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this note?')) return
    if (id === selectedId) await flushPending()
    setError(null)
    try {
      const res = await fetch(`/api/admin/notes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || data.ok !== true) throw new Error(data.error || 'Delete failed')
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id)
        if (selectedId === id) {
          setSelectedId(next[0]?.id ?? null)
        }
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  function onTitleChange(v: string) {
    setTitle(v)
    if (!selectedId) return
    setItems((prev) =>
      prev.map((x) => (x.id === selectedId ? { ...x, title: v } : x)),
    )
    scheduleSave(selectedId, v, body)
  }

  function onBodyChange(v: string) {
    setBody(v)
    if (!selectedId) return
    setItems((prev) =>
      prev.map((x) => (x.id === selectedId ? { ...x, body: v } : x)),
    )
    scheduleSave(selectedId, title, v)
  }

  const rootClass = ['notes-panel', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <div className="notes-panel__toolbar">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleNew()}>
          New note
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <span className="notes-panel__save" aria-live="polite">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && 'Save failed'}
        </span>
      </div>

      {error && (
        <p className="error-text notes-panel__error" role="status">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <p className="notes-panel__empty">Loading notes…</p>
      ) : items.length === 0 ? (
        <p className="notes-panel__empty">No notes yet. Create one to get started.</p>
      ) : (
        <div className="notes-panel__main">
          <aside className="notes-panel__list" aria-label="Notes list">
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notes-panel__list-item${n.id === selectedId ? ' notes-panel__list-item--active' : ''}`}
                    onClick={() => void selectNote(n.id)}
                  >
                    <span className="notes-panel__list-title">{n.title.trim() || 'Untitled'}</span>
                    <span className="notes-panel__list-date">
                      {new Date(n.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="notes-panel__editor">
            {selected ? (
              <>
                <div className="notes-panel__editor-head">
                  <label className="notes-panel__title-label">
                    <span className="sr-only">Title</span>
                    <input
                      className="notes-panel__title-input"
                      value={title}
                      onChange={(e) => onTitleChange(e.target.value)}
                      placeholder="Title"
                    />
                  </label>
                  <div className="notes-panel__editor-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm notes-panel__delete"
                      onClick={() => void handleDelete(selected.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <textarea
                  className="notes-panel__body"
                  value={body}
                  onChange={(e) => onBodyChange(e.target.value)}
                  placeholder="Write something…"
                  spellCheck
                />
              </>
            ) : (
              <p className="notes-panel__empty">Select a note.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
