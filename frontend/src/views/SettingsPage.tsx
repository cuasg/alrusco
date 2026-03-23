import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

type GithubIntegration = {
  owner: string | null
  ownerKind: 'user' | 'org'
  hasToken: boolean
  tokenLast4: string | null
  encryptionConfigured: boolean
  lastSyncAt: string | null
}

export function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [ghOwner, setGhOwner] = useState('')
  const [ghOwnerKind, setGhOwnerKind] = useState<'user' | 'org'>('user')
  const [ghToken, setGhToken] = useState('')
  const [integration, setIntegration] = useState<GithubIntegration | null>(null)
  const [ghLoading, setGhLoading] = useState(true)
  const [ghSaving, setGhSaving] = useState(false)
  const [ghMessage, setGhMessage] = useState<string | null>(null)
  const [ghError, setGhError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadIntegration = useCallback(async () => {
    setGhLoading(true)
    setGhError(null)
    try {
      const res = await fetch('/api/admin/integrations/github', {
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as {
        integration?: GithubIntegration
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load GitHub settings')
      }
      if (data.integration) {
        setIntegration(data.integration)
        setGhOwner(data.integration.owner || '')
        setGhOwnerKind(data.integration.ownerKind)
      }
    } catch (err) {
      setGhError(err instanceof Error ? err.message : 'Failed to load GitHub settings')
    } finally {
      setGhLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadIntegration()
  }, [loadIntegration])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Password change failed')
      }
      setMessage('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed')
    }
  }

  async function handleGithubSave(e: FormEvent) {
    e.preventDefault()
    setGhSaving(true)
    setGhMessage(null)
    setGhError(null)
    try {
      const body: {
        owner: string
        ownerKind: string
        token?: string
        clearToken?: boolean
      } = {
        owner: ghOwner.trim(),
        ownerKind: ghOwnerKind,
      }
      if (ghToken.trim()) {
        body.token = ghToken.trim()
      }
      const res = await fetch('/api/admin/integrations/github', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        integration?: GithubIntegration
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save GitHub settings')
      }
      if (data.integration) {
        setIntegration(data.integration)
      }
      setGhToken('')
      setGhMessage('GitHub settings saved.')
    } catch (err) {
      setGhError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setGhSaving(false)
    }
  }

  async function handleClearToken() {
    if (!window.confirm('Remove the stored GitHub token from this server?')) return
    setGhSaving(true)
    setGhMessage(null)
    setGhError(null)
    try {
      const res = await fetch('/api/admin/integrations/github', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clearToken: true }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        integration?: GithubIntegration
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear token')
      }
      if (data.integration) {
        setIntegration(data.integration)
      }
      setGhMessage('Token removed.')
    } catch (err) {
      setGhError(err instanceof Error ? err.message : 'Failed to clear token')
    } finally {
      setGhSaving(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setGhMessage(null)
    setGhError(null)
    try {
      const res = await fetch('/api/admin/integrations/github/sync', {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: { created: number; updated: number; skipped: number; totalRemote: number }
        integration?: GithubIntegration
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed')
      }
      if (data.integration) {
        setIntegration(data.integration)
      }
      const r = data.result
      if (r) {
        setGhMessage(
          `Sync complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped (forks/archived), ${r.totalRemote} repos from GitHub.`,
        )
      }
    } catch (err) {
      setGhError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="page settings-page">
      <h1>Settings</h1>

      <h2>GitHub projects</h2>
      <div className="card settings-card settings-github-card">
        <p className="muted-text">
          Connect your GitHub user or organization to import repositories as portfolio projects. Your
          token is stored encrypted on the server (set <code>CREDENTIALS_ENCRYPTION_KEY</code> in the
          backend environment). You can also set <code>GITHUB_TOKEN</code> /{' '}
          <code>GITHUB_USERNAME</code> in the environment to override stored values.
        </p>
        {ghLoading && <p className="muted-text">Loading…</p>}
        {!ghLoading && integration && (
          <ul className="settings-github-status muted-text">
            <li>
              Encryption key configured:{' '}
              <strong>{integration.encryptionConfigured ? 'yes' : 'no'}</strong>
            </li>
            <li>
              Token:{' '}
              {integration.hasToken ? (
                <>
                  configured
                  {integration.tokenLast4 ? ` (…${integration.tokenLast4})` : ''}
                </>
              ) : (
                'not set (public API only — low rate limits)'
              )}
            </li>
            <li>
              Last sync:{' '}
              {integration.lastSyncAt
                ? new Date(integration.lastSyncAt).toLocaleString()
                : 'never'}
            </li>
          </ul>
        )}
        <form onSubmit={handleGithubSave}>
          <label>
            GitHub username or org name
            <input
              type="text"
              value={ghOwner}
              onChange={(e) => setGhOwner(e.target.value)}
              placeholder="octocat"
              autoComplete="off"
            />
          </label>
          <label>
            List repos for
            <select
              value={ghOwnerKind}
              onChange={(e) => setGhOwnerKind(e.target.value as 'user' | 'org')}
            >
              <option value="user">User</option>
              <option value="org">Organization</option>
            </select>
          </label>
          <label>
            Personal access token (optional but recommended)
            <input
              type="password"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder={integration?.hasToken ? 'Leave blank to keep current token' : 'ghp_…'}
              autoComplete="off"
            />
          </label>
          <p className="muted-text settings-github-hint">
            Create a fine-grained or classic PAT with <strong>Contents: read</strong> (public repos) or{' '}
            <strong>repo</strong> scope if you need private repos.{' '}
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub token settings
            </a>
          </p>
          {ghError && <p className="error-text">{ghError}</p>}
          {ghMessage && <p className="success">{ghMessage}</p>}
          <div className="settings-github-actions">
            <button type="submit" className="btn btn-primary" disabled={ghSaving}>
              {ghSaving ? 'Saving…' : 'Save GitHub settings'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={ghSaving || !integration?.hasToken}
              onClick={() => void handleClearToken()}
            >
              Remove stored token
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={syncing || ghSaving}
              onClick={() => void handleSync()}
            >
              {syncing ? 'Syncing…' : 'Sync repos now'}
            </button>
          </div>
        </form>
      </div>

      <h2>Change password</h2>
      <form className="card settings-card" onSubmit={handleSubmit}>
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <button type="submit">Update password</button>
      </form>
    </section>
  )
}
