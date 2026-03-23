import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import type { Project } from '../views/ProjectsPage'

type Props = {
  open: boolean
  initialProject: Project | null
  onClose: () => void
  onSaved: (project: Project) => void
  onDeleted?: (id: number) => void
}

const ALLOWED_CATEGORIES = ['infra', 'apps', 'oss'] as const
const ALLOWED_STATUSES = ['active', 'archived', 'draft', 'planning'] as const

type ApiProject = {
  id: number
  title: string
  summary: string
  category: string
  status: string
  body: string | null
  tags: string[]
  slug: string
  createdAt: string
  updatedAt: string
  githubRepoId?: number | null
  source?: string
  repoFullName?: string | null
  repoHtmlUrl?: string | null
  repoHomepage?: string | null
  repoPushedAt?: string | null
  repoLanguage?: string | null
  syncHidden?: boolean
}

function projectFromApi(p: ApiProject): Project {
  return {
    id: p.id,
    title: p.title,
    summary: p.summary,
    category: p.category,
    status: p.status,
    tags: p.tags,
    slug: p.slug,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    githubRepoId: p.githubRepoId ?? null,
    source: p.source === 'github' ? 'github' : 'manual',
    repoFullName: p.repoFullName ?? null,
    repoHtmlUrl: p.repoHtmlUrl ?? null,
    repoHomepage: p.repoHomepage ?? null,
    repoPushedAt: p.repoPushedAt ?? null,
    repoLanguage: p.repoLanguage ?? null,
    syncHidden: Boolean(p.syncHidden),
    body: p.body,
  }
}

export function ProjectEditModal({ open, initialProject, onClose, onSaved, onDeleted }: Props) {
  const isEdit = Boolean(initialProject)

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [body, setBody] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [syncHidden, setSyncHidden] = useState(false)
  const [githubMeta, setGithubMeta] = useState<{
    repoFullName: string | null
    repoHtmlUrl: string | null
  } | null>(null)

  const [saving, setSaving] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    if (initialProject) {
      setTitle(initialProject.title)
      setSummary(initialProject.summary)
      setCategory(initialProject.category)
      setStatus(initialProject.status)
      setBody('')
      setTagsInput(initialProject.tags.join(', '))
      setSyncHidden(initialProject.syncHidden)
      setGithubMeta(
        initialProject.source === 'github'
          ? {
              repoFullName: initialProject.repoFullName,
              repoHtmlUrl: initialProject.repoHtmlUrl,
            }
          : null,
      )
    } else {
      setTitle('')
      setSummary('')
      setCategory('')
      setStatus('')
      setBody('')
      setTagsInput('')
      setSyncHidden(false)
      setGithubMeta(null)
    }
    setError(null)
    setSaving(false)
    setLoadingDetails(false)
  }, [open, initialProject])

  useEffect(() => {
    async function loadDetails() {
      if (!open || !initialProject) return

      setLoadingDetails(true)
      try {
        const res = await fetch(`/api/projects/${initialProject.id}`, {
          credentials: 'include',
        })
        const data = (await res.json().catch(() => ({}))) as { project?: ApiProject; error?: string }
        if (!res.ok || !data.project) {
          throw new Error(data.error || 'Failed to load project details')
        }

        setTitle(data.project.title)
        setSummary(data.project.summary)
        setCategory(data.project.category)
        setStatus(data.project.status)
        setBody(data.project.body ?? '')
        setTagsInput(data.project.tags.join(', '))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project details')
      } finally {
        setLoadingDetails(false)
      }
    }

    if (isEdit) {
      void loadDetails()
    }
  }, [open, initialProject, isEdit])

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

    try {
      const payload: Record<string, unknown> = {
        title,
        summary,
        category,
        status,
        body: body.trim() ? body : null,
        tags,
      }
      if (isEdit) {
        payload.syncHidden = syncHidden
      }

      const url = isEdit ? `/api/admin/projects/${initialProject!.id}` : '/api/admin/projects'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = (await res.json().catch(() => ({}))) as { project?: ApiProject; error?: string }
      if (!res.ok || !data.project) {
        throw new Error(data.error || 'Failed to save project')
      }

      onSaved(projectFromApi(data.project))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialProject || !onDeleted) return
    if (!window.confirm(`Delete project "${initialProject.title}"? This cannot be undone.`)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/projects/${initialProject.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || data.ok !== true) {
        throw new Error(data.error || 'Failed to delete project')
      }

      onDeleted(initialProject.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
        <h2 id="project-modal-title">{isEdit ? 'Edit project' : 'New project'}</h2>
        <form className="settings-card" onSubmit={handleSubmit}>
          {githubMeta?.repoFullName && (
            <p className="muted-text project-modal-github-note">
              Synced from GitHub: <strong>{githubMeta.repoFullName}</strong>
              {githubMeta.repoHtmlUrl && (
                <>
                  {' · '}
                  <a href={githubMeta.repoHtmlUrl} target="_blank" rel="noopener noreferrer">
                    Open repo
                  </a>
                </>
              )}
              . Re-sync from Settings updates repo metadata without overwriting your title, summary, or
              body.
            </p>
          )}
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Summary
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              required
            />
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">Select category</option>
              {category && !ALLOWED_CATEGORIES.includes(category as any) && (
                <option value={category}>{category}</option>
              )}
              {ALLOWED_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'infra' ? 'Infrastructure' : c === 'apps' ? 'Applications' : 'Open source'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
            >
              <option value="">Select status</option>
              {status && !ALLOWED_STATUSES.includes(status as any) && (
                <option value={status}>{status}</option>
              )}
              {ALLOWED_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tech tags (comma-separated)
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="kubernetes, prometheus, grafana"
            />
          </label>
          <label>
            Long-form body (optional)
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Optional long-form description or notes. Markdown-friendly."
            />
          </label>
          {isEdit && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={syncHidden}
                onChange={(e) => setSyncHidden(e.target.checked)}
              />
              Hide from public projects list (still reachable by direct link if someone has the ID)
            </label>
          )}
          {loadingDetails && isEdit && (
            <p className="muted-text" role="status">
              Loading project details…
            </p>
          )}
          {error && (
            <p className="error-text" role="status">
              {error}
            </p>
          )}
          <div className="modal-actions">
            {isEdit && onDeleted && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleDelete}
                disabled={saving}
              >
                Delete project
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
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

