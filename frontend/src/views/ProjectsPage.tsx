import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ProjectEditModal } from '../ui/ProjectEditModal'

export type Project = {
  id: number
  title: string
  summary: string
  category: string
  status: string
  tags: string[]
  slug: string
  createdAt: string
  updatedAt: string
  githubRepoId: number | null
  source: 'manual' | 'github'
  repoFullName: string | null
  repoHtmlUrl: string | null
  repoHomepage: string | null
  repoPushedAt: string | null
  repoLanguage: string | null
  syncHidden: boolean
  body?: string | null
}

const CATEGORY_KEYS = ['infra', 'apps', 'oss'] as const
type CategoryFilter = 'all' | (typeof CATEGORY_KEYS)[number]

function categoryFromSearch(searchParams: URLSearchParams): CategoryFilter {
  const c = searchParams.get('category')
  if (c && (CATEGORY_KEYS as readonly string[]).includes(c)) return c as CategoryFilter
  return 'all'
}

export function ProjectsPage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = useMemo(() => categoryFromSearch(searchParams), [searchParams])

  function selectCategory(next: CategoryFilter) {
    if (next === 'all') {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.delete('category')
          return p
        },
        { replace: true },
      )
    } else {
      setSearchParams({ category: next }, { replace: true })
    }
  }
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/projects')
        if (!res.ok) {
          throw new Error(`Failed to load projects: ${res.status}`)
        }

        const data = (await res.json()) as { projects: Project[] }
        if (!cancelled) {
          setProjects(data.projects)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError('Unable to load projects right now.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  function handleCreateClick() {
    setEditingProject(null)
    setModalOpen(true)
  }

  function handleEditClick(project: Project) {
    setEditingProject(project)
    setModalOpen(true)
  }

  function handleSaved(saved: Project) {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === saved.id)
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? saved : p))
      }
      return [saved, ...prev]
    })
    setModalOpen(false)
    setEditingProject(null)
  }

  function handleDeleted(id: number) {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setModalOpen(false)
    setEditingProject(null)
  }

  const filtered = useMemo(() => {
    const list = projects
    if (category === 'all') return list
    return list.filter((p) => p.category === category)
  }, [category, projects])

  return (
    <section className="page projects-page">
      <header className="page-header">
        <h1>Projects</h1>
        <p>Selected work across infrastructure, applications, and open source.</p>
        {user && !authLoading && (
          <div className="page-header-actions">
            <button type="button" className="btn btn-primary" onClick={handleCreateClick}>
              + New project
            </button>
          </div>
        )}
      </header>
      <div className="projects-filters">
        <button
          type="button"
          className={category === 'all' ? 'chip chip--active' : 'chip'}
          onClick={() => selectCategory('all')}
        >
          All
        </button>
        <button
          type="button"
          className={category === 'infra' ? 'chip chip--active' : 'chip'}
          onClick={() => selectCategory('infra')}
        >
          Infrastructure
        </button>
        <button
          type="button"
          className={category === 'apps' ? 'chip chip--active' : 'chip'}
          onClick={() => selectCategory('apps')}
        >
          Applications
        </button>
        <button
          type="button"
          className={category === 'oss' ? 'chip chip--active' : 'chip'}
          onClick={() => selectCategory('oss')}
        >
          Open source
        </button>
      </div>
      <div className="cards-grid">
        {loading && !projects.length && (
          <p className="muted-text">Loading projects…</p>
        )}
        {error && (
          <p className="error-text" role="status">
            {error}
          </p>
        )}
        {!loading && !error && !filtered.length && (
          <p className="muted-text">No projects found for this category.</p>
        )}
        {!loading &&
          filtered.map((project) => (
            <article key={project.id} className="card project-card">
              <header>
                <div>
                  <h2>{project.title}</h2>
                  <span className="badge badge--subtle">{project.status}</span>
                </div>
                {user && !authLoading && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => handleEditClick(project)}
                    aria-label={`Edit ${project.title}`}
                  >
                    Edit
                  </button>
                )}
              </header>
              <p>{project.summary}</p>
              {(project.repoHtmlUrl || project.repoHomepage || project.repoLanguage) && (
                <div className="project-card-meta">
                  {project.repoLanguage && (
                    <span className="badge badge--subtle">{project.repoLanguage}</span>
                  )}
                  {project.source === 'github' && (
                    <span className="badge badge--subtle">GitHub</span>
                  )}
                </div>
              )}
              <div className="project-card-links">
                {project.repoHtmlUrl && (
                  <a
                    href={project.repoHtmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="project-card-link"
                  >
                    Repository
                  </a>
                )}
                {project.repoHomepage && (
                  <a
                    href={project.repoHomepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="project-card-link"
                  >
                    Website / demo
                  </a>
                )}
              </div>
              <div className="tags">
                {project.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </article>
          ))}
      </div>
      {user && !authLoading && (
        <ProjectEditModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setEditingProject(null)
          }}
          initialProject={editingProject}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </section>
  )
}

