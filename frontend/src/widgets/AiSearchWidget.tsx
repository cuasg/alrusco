import type { FormEvent } from 'react'
import { useState } from 'react'
import type { WidgetRenderProps } from '../dashboard/WidgetRegistry'

export function AiSearchWidget({ editMode }: WidgetRenderProps) {
  const [query, setQuery] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    const url = `https://chatgpt.com/?q=${encodeURIComponent(q)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <p className="hp-muted">AI search {editMode ? '(opens ChatGPT in a new tab)' : ''}</p>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ width: '100%' }}
          placeholder="Ask…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary">
          Ask
        </button>
      </form>
    </div>
  )
}

