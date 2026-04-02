import type { FormEvent } from 'react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { WidgetRenderProps } from '../dashboard/WidgetRegistry'

/** Shown in tag datalist; merged with tags already used on feeds. */
const RSS_TAG_PRESETS = [
  'news',
  'tech',
  'markets',
  'business',
  'science',
  'world',
  'culture',
  'sports',
  'local',
  'politics',
  'health',
]

type RssItem = {
  id: string
  title: string
  link: string
  publishedAt?: string
  summary?: string
  imageUrl?: string
  /** Stable id from server — use for feed scoping (not display title). */
  feedId?: string
  feedTitle?: string
  tags: string[]
}

type FeedDef = {
  id: string
  url: string
  title?: string
  tags?: string[]
  enabled?: boolean
}

function dedupeRssItems(list: RssItem[]): RssItem[] {
  const seen = new Set<string>()
  const out: RssItem[] = []
  for (const it of list) {
    const k = `${it.feedId ?? ''}\0${it.id}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
  return out
}

function rssSummaryPlain(raw: string | undefined, maxLen = 280): string {
  if (!raw?.trim()) return ''
  const t = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t
}

export function RssWidget({ editMode, isAuthenticated }: WidgetRenderProps) {
  const newTagListId = useId()
  const [items, setItems] = useState<RssItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feeds, setFeeds] = useState<FeedDef[] | null>(null)
  const [feedUrl, setFeedUrl] = useState('')
  const [newFeedTagsInput, setNewFeedTagsInput] = useState('news')
  const [tagEdits, setTagEdits] = useState<Record<string, string>>({})
  const [feedError, setFeedError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [tab, setTab] = useState<'all' | 'feeds' | 'saved'>('all')
  /** 'all' or feed id (matches `feedId` on items). */
  const [selectedFeedId, setSelectedFeedId] = useState<string>('all')
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())

  const reloadRssItems = useCallback(async () => {
    try {
      const res = await fetch('/api/rss/items')
      if (!res.ok) return
      const data = (await res.json()) as { items?: RssItem[] }
      setItems(dedupeRssItems(data.items ?? []))
    } catch {
      /* ignore */
    }
  }, [])

  const refreshBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rss/bookmarks', { credentials: 'include' })
      if (!res.ok) {
        setBookmarks(new Set())
        return
      }
      const data = (await res.json()) as { ids?: unknown }
      const ids = Array.isArray(data.ids)
        ? data.ids
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.trim())
            .filter(Boolean)
        : []
      setBookmarks(new Set(ids))
    } catch {
      setBookmarks(new Set())
    }
  }, [])

  /** Items in scope for tag chips (per tab / feed — not yet filtered by selected tag). */
  const itemsForTagScope = useMemo(() => {
    const all = dedupeRssItems(items)
    const bmk = isAuthenticated ? bookmarks : new Set<string>()
    if (tab === 'saved') return all.filter((it) => bmk.has(it.id))
    if (tab === 'feeds' && selectedFeedId !== 'all') {
      return all.filter((it) => (it.feedId ?? '') === selectedFeedId)
    }
    return all
  }, [items, tab, bookmarks, selectedFeedId, isAuthenticated])

  const activeTags = useMemo(() => {
    const set = new Set<string>()
    for (const it of itemsForTagScope) for (const t of it.tags || []) set.add(t)
    return Array.from(set).sort()
  }, [itemsForTagScope])

  const visibleItems = useMemo(() => {
    const all = dedupeRssItems(items)
    const bmk = isAuthenticated ? bookmarks : new Set<string>()

    if (tab === 'saved') {
      let base = all.filter((it) => bmk.has(it.id))
      if (selectedTag !== 'all') base = base.filter((it) => (it.tags ?? []).includes(selectedTag))
      return base
    }

    if (tab === 'feeds') {
      let base = all
      if (selectedFeedId !== 'all') {
        base = base.filter((it) => (it.feedId ?? '') === selectedFeedId)
      }
      if (selectedTag !== 'all') base = base.filter((it) => (it.tags ?? []).includes(selectedTag))
      return base
    }

    let base = all
    if (selectedTag !== 'all') base = base.filter((it) => (it.tags ?? []).includes(selectedTag))
    return base
  }, [items, selectedTag, tab, bookmarks, selectedFeedId, isAuthenticated])

  const feedOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) {
      const id = it.feedId?.trim()
      if (!id) continue
      const title = (it.feedTitle ?? id).trim() || id
      if (!map.has(id)) map.set(id, title)
    }
    for (const f of feeds ?? []) {
      if (!map.has(f.id)) map.set(f.id, f.title?.trim() || f.url.slice(0, 48) || f.id)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [items, feeds])

  const tagSuggestions = useMemo(() => {
    const s = new Set<string>(RSS_TAG_PRESETS)
    for (const f of feeds ?? []) for (const t of f.tags ?? []) s.add(t)
    for (const it of items) for (const t of it.tags ?? []) s.add(t)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [feeds, items])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/rss/items')
        if (!res.ok) throw new Error('failed')
        const data = (await res.json()) as { items?: RssItem[] }
        if (!cancelled) setItems(dedupeRssItems(data.items ?? []))
      } catch {
        if (!cancelled) setError('Failed to load RSS.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void refreshBookmarks()
  }, [refreshBookmarks])

  useEffect(() => {
    if (tab === 'saved') void refreshBookmarks()
  }, [tab, refreshBookmarks])

  useEffect(() => {
    let cancelled = false
    async function loadFeeds() {
      try {
        const res = await fetch('/api/admin/rss/feeds', { credentials: 'include' })
        if (!res.ok) return
        const data = (await res.json()) as { feeds?: FeedDef[] }
        if (!cancelled) setFeeds(data.feeds ?? [])
      } catch {
        // ignore
      }
    }
    void loadFeeds()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!feeds) return
    setTagEdits((prev) => {
      const next = { ...prev }
      for (const f of feeds) {
        if (next[f.id] === undefined) next[f.id] = (f.tags ?? []).join(', ')
      }
      return next
    })
  }, [feeds])

  useEffect(() => {
    if (selectedTag !== 'all' && !activeTags.includes(selectedTag)) {
      setSelectedTag('all')
    }
  }, [activeTags, selectedTag])

  async function saveBookmarks(next: Set<string>) {
    if (!isAuthenticated) return
    const ids = Array.from(next)
    await fetch('/api/admin/rss/bookmarks', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids),
    })
    setBookmarks(new Set(ids))
  }

  function parseTagsInput(raw: string): string[] {
    const tags = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8)
    return tags.length ? tags : ['news']
  }

  async function persistFeeds(next: FeedDef[]) {
    if (!isAuthenticated) {
      setFeedError('Sign in to manage RSS feeds.')
      return false
    }
    setFeedError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/rss/feeds', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        setFeedError('Could not save feeds. Try again or check that you are signed in.')
        return false
      }
      setFeeds(next)
      await reloadRssItems()
      return true
    } finally {
      setSaving(false)
    }
  }

  async function addFeed(e: FormEvent) {
    e.preventDefault()
    if (!editMode || !isAuthenticated) return
    const url = feedUrl.trim()
    if (!url) return
    const id = `feed-${Math.random().toString(36).slice(2, 10)}`
    const tags = parseTagsInput(newFeedTagsInput)
    const next = [...(feeds ?? []), { id, url, tags, enabled: true }]
    const ok = await persistFeeds(next)
    if (ok) {
      setFeedUrl('')
      setNewFeedTagsInput(tags.join(', '))
    }
  }

  async function saveFeedTagsRow(feedId: string) {
    if (!editMode || !isAuthenticated || !feeds) return
    const tags = parseTagsInput(tagEdits[feedId] ?? '')
    const next = feeds.map((f) => (f.id === feedId ? { ...f, tags } : f))
    const ok = await persistFeeds(next)
    if (ok) setTagEdits((prev) => ({ ...prev, [feedId]: tags.join(', ') }))
  }

  return (
    <div className="rss-widget">
      <div
        className="rss-widget-top"
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}
      >
        <p className="hp-muted" style={{ margin: 0 }}>
          RSS {loading ? 'loading…' : error ? error : `${items.length} items`}
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="dash-tabs">
            <button
              type="button"
              className={`dash-tab ${tab === 'all' ? 'dash-tab--active' : ''}`}
              onClick={() => {
                setTab('all')
                setSelectedFeedId('all')
              }}
            >
              All
            </button>
            <button
              type="button"
              className={`dash-tab ${tab === 'feeds' ? 'dash-tab--active' : ''}`}
              onClick={() => setTab('feeds')}
            >
              Feeds
            </button>
            <button
              type="button"
              className={`dash-tab ${tab === 'saved' ? 'dash-tab--active' : ''}`}
              onClick={() => {
                setTab('saved')
                setSelectedFeedId('all')
              }}
            >
              Saved
            </button>
          </div>
          {!!activeTags.length && (
            <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
              <option value="all">All</option>
              {activeTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          <span className="hp-muted" style={{ margin: 0 }}>
            Saved: {isAuthenticated ? bookmarks.size : 0}
          </span>
        </div>
      </div>

      {tab === 'feeds' && (
        <div
          className="rss-widget-top"
          style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <span className="hp-muted" style={{ fontSize: 12 }}>
            Feed
          </span>
          <select
            value={selectedFeedId}
            onChange={(e) => {
              setSelectedFeedId(e.target.value)
              setSelectedTag('all')
            }}
          >
            <option value="all">All feeds</option>
            {feedOptions.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </div>
      )}

      {editMode && isAuthenticated && (
        <form onSubmit={(e) => void addFeed(e)} style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <input value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="Add RSS or Atom feed URL…" />
          <label className="hp-muted" style={{ fontSize: 12, margin: 0 }}>
            Tags (comma-separated) — pick a suggestion or type your own
          </label>
          <input
            list={newTagListId}
            value={newFeedTagsInput}
            onChange={(e) => setNewFeedTagsInput(e.target.value)}
            placeholder="e.g. tech, markets"
          />
          <datalist id={newTagListId}>
            {tagSuggestions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add feed'}
          </button>
          {feedError ? (
            <p className="hp-muted" style={{ margin: 0, color: 'var(--error-fg)' }}>
              {feedError}
            </p>
          ) : null}
          {feeds && (
            <p className="hp-muted" style={{ margin: 0 }}>
              Feeds configured: {feeds.length}
            </p>
          )}
        </form>
      )}

      {editMode && isAuthenticated && feeds && feeds.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <p className="hp-muted" style={{ margin: 0, fontSize: 12 }}>
            Edit tags for existing feeds (comma-separated). Use suggestions or type new tags.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {feeds.map((f) => {
              const editListId = `${newTagListId}-edit-${f.id}`
              return (
                <li
                  key={f.id}
                  style={{
                    display: 'grid',
                    gap: 6,
                    padding: '10px 12px',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 12,
                  }}
                >
                  <span className="hp-muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                    {f.url}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <input
                      style={{ flex: '1 1 180px', minWidth: 0 }}
                      list={editListId}
                      value={tagEdits[f.id] ?? ''}
                      onChange={(e) => setTagEdits((prev) => ({ ...prev, [f.id]: e.target.value }))}
                      placeholder="tags"
                      aria-label={`Tags for ${f.url}`}
                    />
                    <datalist id={editListId}>
                      {tagSuggestions.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => void saveFeedTagsRow(f.id)}>
                      Save tags
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div
        key={`rss-${tab}-${selectedFeedId}-${selectedTag}`}
        className="rss-list"
        style={{ marginTop: 10, flex: 1, minHeight: 0 }}
      >
        {tab === 'saved' && !isAuthenticated && (
          <p className="rss-empty">Sign in to view saved articles.</p>
        )}
        {tab === 'saved' && isAuthenticated && bookmarks.size === 0 && (
          <p className="rss-empty">No saved articles yet. Use Save on a story to add it here.</p>
        )}
        {tab === 'saved' && isAuthenticated && bookmarks.size > 0 && visibleItems.length === 0 && (
          <p className="rss-empty">No saved articles match this tag filter.</p>
        )}
        {tab === 'feeds' && selectedFeedId !== 'all' && visibleItems.length === 0 && (
          <p className="rss-empty">No items for this feed (or feed id missing). Try All feeds.</p>
        )}
        {visibleItems.slice(0, 50).map((it) => {
          const summaryPlain = rssSummaryPlain(it.summary)
          return (
            <article
              key={`${it.feedId ?? 'na'}:${it.id}`}
              className={`rss-card ${it.imageUrl ? 'rss-card--with-image' : 'rss-card--no-image'}`}
            >
              {!!it.imageUrl && (
                <a href={it.link} target="_blank" rel="noopener noreferrer" className="rss-thumb">
                  <img src={it.imageUrl} alt="" loading="lazy" />
                </a>
              )}
              <div className="rss-main">
                <div className="rss-top">
                  <a href={it.link} target="_blank" rel="noopener noreferrer" className="rss-title">
                    {it.title}
                  </a>
                  {isAuthenticated ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const next = new Set(bookmarks)
                        if (next.has(it.id)) next.delete(it.id)
                        else next.add(it.id)
                        void saveBookmarks(next)
                      }}
                    >
                      {bookmarks.has(it.id) ? 'Saved' : 'Save'}
                    </button>
                  ) : null}
                </div>
                <div className="rss-meta">
                  {it.feedTitle ? <span>{it.feedTitle}</span> : null}
                  {it.publishedAt ? <span>· {new Date(it.publishedAt).toLocaleString()}</span> : null}
                </div>
                {summaryPlain ? <p className="rss-summary">{summaryPlain}</p> : null}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

