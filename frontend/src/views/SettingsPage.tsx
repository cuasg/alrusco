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

type RuntimeIntegration = {
  encryptionConfigured: boolean
  hasMarketApiKey: boolean
  hasFinnhubApiKey: boolean
  hasOpenAiApiKey: boolean
  hasWeatherApiKey: boolean
  marketProvider: 'alpha_vantage' | 'finnhub'
  marketCacheTtlMs: number | null
  rssMinRefreshMs: number | null
  openAiModel: string | null
  weatherFixedLocation: boolean | null
  weatherLat: string | null
  weatherLon: string | null
  githubSyncExcludeForks: boolean | null
  githubSyncExcludeArchived: boolean | null
  githubApiUserAgent: string | null
}

type SecurityBrief = {
  checks?: {
    id: string
    status: 'pass' | 'warn' | 'fail'
    title: string
    detail: string
    recommendedFix?: string
  }[]
  generatedAt: string
  env: { nodeEnv: string; isProd: boolean }
  headers: { hstsEnabled: boolean; cspDisabled: boolean }
  auth: {
    cookie: { name: string; secure: boolean; sameSite: string; domain: string }
    trustProxyHops: number
    bootstrapAllowed: boolean
    adminEnvInitAllowed: boolean
    adminResetEnabled: boolean
  }
  rateLimits: {
    globalPer15m: number
    authAttemptsPer10m: number
    extendSessionPerHour: number
    appsRedirectsPer10m: number
  }
  redirects: {
    lanAppHostSuffixes: string[]
    allowLocalhost: boolean
    lanAppsAllPassAllowlist: boolean
  }
  storage: { dataDirHint: string; authDbHint: string }
  secrets: { encryptionConfigured: boolean; jwtSecretConfigured: boolean }
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

  const [runtime, setRuntime] = useState<RuntimeIntegration | null>(null)
  const [runtimeLoading, setRuntimeLoading] = useState(true)
  const [runtimeSaving, setRuntimeSaving] = useState(false)
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [marketApiKey, setMarketApiKey] = useState('')
  const [finnhubApiKey, setFinnhubApiKey] = useState('')
  const [openAiApiKey, setOpenAiApiKey] = useState('')
  const [weatherApiKey, setWeatherApiKey] = useState('')
  const [openAiModel, setOpenAiModel] = useState('gpt-4o-mini')
  const [marketProvider, setMarketProvider] = useState<'alpha_vantage' | 'finnhub'>('alpha_vantage')
  const [marketCacheTtlMs, setMarketCacheTtlMs] = useState('300000')
  const [rssMinRefreshMs, setRssMinRefreshMs] = useState('600000')
  const [weatherFixedLocation, setWeatherFixedLocation] = useState(true)
  const [weatherLat, setWeatherLat] = useState('')
  const [weatherLon, setWeatherLon] = useState('')
  const [githubSyncExcludeForks, setGithubSyncExcludeForks] = useState(true)
  const [githubSyncExcludeArchived, setGithubSyncExcludeArchived] = useState(true)
  const [githubApiUserAgent, setGithubApiUserAgent] = useState('AlruscoPortfolio/1.0 (github sync)')

  const [brief, setBrief] = useState<SecurityBrief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [briefError, setBriefError] = useState<string | null>(null)

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

  const loadRuntimeIntegration = useCallback(async () => {
    setRuntimeLoading(true)
    setRuntimeError(null)
    try {
      const res = await fetch('/api/admin/integrations/runtime', {
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as {
        integration?: RuntimeIntegration
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load runtime settings')
      }
      if (data.integration) {
        setRuntime(data.integration)
        setOpenAiModel(data.integration.openAiModel || 'gpt-4o-mini')
        setMarketProvider(data.integration.marketProvider || 'alpha_vantage')
        setMarketCacheTtlMs(String(data.integration.marketCacheTtlMs ?? 300000))
        setRssMinRefreshMs(String(data.integration.rssMinRefreshMs ?? 600000))
        setWeatherFixedLocation(data.integration.weatherFixedLocation ?? true)
        setWeatherLat(data.integration.weatherLat ?? '')
        setWeatherLon(data.integration.weatherLon ?? '')
        setGithubSyncExcludeForks(data.integration.githubSyncExcludeForks ?? true)
        setGithubSyncExcludeArchived(data.integration.githubSyncExcludeArchived ?? true)
        setGithubApiUserAgent(data.integration.githubApiUserAgent ?? 'AlruscoPortfolio/1.0 (github sync)')
      }
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : 'Failed to load runtime settings')
    } finally {
      setRuntimeLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRuntimeIntegration()
  }, [loadRuntimeIntegration])

  const loadSecurityBrief = useCallback(async () => {
    setBriefLoading(true)
    setBriefError(null)
    try {
      const res = await fetch('/api/admin/security/brief', { credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as { error?: string } & SecurityBrief
      if (!res.ok) throw new Error(data.error || 'Failed to load security brief')
      setBrief(data)
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Failed to load security brief')
    } finally {
      setBriefLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSecurityBrief()
  }, [loadSecurityBrief])

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

  async function handleRuntimeSave(e: FormEvent) {
    e.preventDefault()
    setRuntimeSaving(true)
    setRuntimeMessage(null)
    setRuntimeError(null)
    try {
      const body: {
        marketApiKey?: string
        finnhubApiKey?: string
        openAiApiKey?: string
        weatherApiKey?: string
        openAiModel: string
        marketProvider: 'alpha_vantage' | 'finnhub'
        marketCacheTtlMs: number
        rssMinRefreshMs: number
        weatherFixedLocation: boolean
        weatherLat?: string
        weatherLon?: string
        githubSyncExcludeForks: boolean
        githubSyncExcludeArchived: boolean
        githubApiUserAgent: string
      } = {
        openAiModel: openAiModel.trim(),
        marketProvider,
        marketCacheTtlMs: Number(marketCacheTtlMs),
        rssMinRefreshMs: Number(rssMinRefreshMs),
        weatherFixedLocation,
        weatherLat: weatherLat.trim(),
        weatherLon: weatherLon.trim(),
        githubSyncExcludeForks,
        githubSyncExcludeArchived,
        githubApiUserAgent: githubApiUserAgent.trim(),
      }
      if (marketApiKey.trim()) body.marketApiKey = marketApiKey.trim()
      if (finnhubApiKey.trim()) body.finnhubApiKey = finnhubApiKey.trim()
      if (openAiApiKey.trim()) body.openAiApiKey = openAiApiKey.trim()
      if (weatherApiKey.trim()) body.weatherApiKey = weatherApiKey.trim()

      const res = await fetch('/api/admin/integrations/runtime', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        integration?: RuntimeIntegration
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save runtime settings')
      }
      if (data.integration) {
        setRuntime(data.integration)
      }
      setMarketApiKey('')
      setFinnhubApiKey('')
      setOpenAiApiKey('')
      setWeatherApiKey('')
      setRuntimeMessage('Runtime integration settings saved.')
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : 'Failed to save runtime settings')
    } finally {
      setRuntimeSaving(false)
    }
  }

  async function clearRuntimeKey(kind: 'market' | 'finnhub' | 'openai' | 'weather') {
    if (!window.confirm('Remove the stored API key from this server?')) return
    setRuntimeSaving(true)
    setRuntimeMessage(null)
    setRuntimeError(null)
    try {
      const res = await fetch('/api/admin/integrations/runtime', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          kind === 'market'
            ? { clearMarketApiKey: true }
            : kind === 'finnhub'
              ? { clearFinnhubApiKey: true }
              : kind === 'openai'
                ? { clearOpenAiApiKey: true }
                : { clearWeatherApiKey: true },
        ),
      })
      const data = (await res.json().catch(() => ({}))) as {
        integration?: RuntimeIntegration
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear key')
      }
      if (data.integration) setRuntime(data.integration)
      setRuntimeMessage('Stored key removed.')
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : 'Failed to clear key')
    } finally {
      setRuntimeSaving(false)
    }
  }

  return (
    <section className="page settings-page">
      <h1>Settings</h1>

      <h2>Security brief</h2>
      <div className="card settings-card settings-github-card">
        <p className="muted-text">
          Quick verification that your security controls are active. This is read-only and never returns
          secrets.
        </p>
        {briefLoading && <p className="muted-text">Loading…</p>}
        {briefError && <p className="error-text">{briefError}</p>}
        {!briefLoading && brief && (
          <>
            {!!brief.checks?.length ? (
              <ul className="settings-github-status muted-text">
                {brief.checks.map((c) => {
                  const label =
                    c.status === 'pass' ? 'PASS' : c.status === 'warn' ? 'WARN' : 'FAIL'
                  const color =
                    c.status === 'pass'
                      ? 'var(--success-fg)'
                      : c.status === 'warn'
                        ? 'var(--warning-fg)'
                        : 'var(--error-fg)'
                  return (
                    <li key={c.id} style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <strong>{c.title}</strong>
                        <strong style={{ color }}>{label}</strong>
                      </div>
                      <div>{c.detail}</div>
                      {c.recommendedFix && (
                        <div>
                          <strong>Fix:</strong> {c.recommendedFix}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <ul className="settings-github-status muted-text">
                <li>
                  Environment: <strong>{brief.env.nodeEnv}</strong>
                </li>
                <li>
                  Cookie:{' '}
                  <strong>
                    {brief.auth.cookie.secure ? 'Secure' : 'NOT secure'} / SameSite=
                    {brief.auth.cookie.sameSite}
                  </strong>{' '}
                  (domain <code>{brief.auth.cookie.domain}</code>)
                </li>
              </ul>
            )}

            <details style={{ marginTop: 10 }}>
              <summary className="muted-text">Show details</summary>
              <pre className="muted-text" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
                {JSON.stringify(brief, null, 2)}
              </pre>
            </details>

            <div className="settings-github-actions" style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => void loadSecurityBrief()}>
                Refresh brief
              </button>
              <span className="muted-text">
                Generated: {new Date(brief.generatedAt).toLocaleString()}
              </span>
            </div>
          </>
        )}
      </div>

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

      <h2>Dashboard integrations</h2>
      <div className="card settings-card settings-github-card">
        <p className="muted-text">
          Configure dashboard runtime integrations (Market, RSS, AI). API keys are stored encrypted on the
          server when <code>CREDENTIALS_ENCRYPTION_KEY</code> is configured. Environment variables remain
          supported as fallback.
        </p>

        {runtimeLoading && <p className="muted-text">Loading…</p>}
        {!runtimeLoading && runtime && (
          <ul className="settings-github-status muted-text">
            <li>
              Encryption key configured: <strong>{runtime.encryptionConfigured ? 'yes' : 'no'}</strong>
            </li>
            <li>
              Market API key: <strong>{runtime.hasMarketApiKey ? 'configured' : 'not set'}</strong>
            </li>
            <li>
              Finnhub API key: <strong>{runtime.hasFinnhubApiKey ? 'configured' : 'not set'}</strong>
            </li>
            <li>
              OpenAI API key: <strong>{runtime.hasOpenAiApiKey ? 'configured' : 'not set'}</strong>
            </li>
            <li>
              Weather API key: <strong>{runtime.hasWeatherApiKey ? 'configured' : 'not set'}</strong>
            </li>
          </ul>
        )}

        <form onSubmit={handleRuntimeSave}>
          <h3>Market &amp; RSS</h3>
          <label>
            Market quote provider
            <select
              value={marketProvider}
              onChange={(e) => setMarketProvider(e.target.value as 'alpha_vantage' | 'finnhub')}
            >
              <option value="alpha_vantage">Alpha Vantage</option>
              <option value="finnhub">Finnhub</option>
            </select>
          </label>
          <label>
            Alpha Vantage API key (optional if set in env)
            <input
              type="password"
              value={marketApiKey}
              onChange={(e) => setMarketApiKey(e.target.value)}
              placeholder={runtime?.hasMarketApiKey ? 'Leave blank to keep current key' : 'Enter API key'}
              autoComplete="off"
            />
          </label>
          <label>
            Finnhub API key (optional if set in env)
            <input
              type="password"
              value={finnhubApiKey}
              onChange={(e) => setFinnhubApiKey(e.target.value)}
              placeholder={runtime?.hasFinnhubApiKey ? 'Leave blank to keep current key' : 'Enter API key'}
              autoComplete="off"
            />
          </label>
          <label>
            Market cache TTL (ms)
            <input
              type="number"
              value={marketCacheTtlMs}
              onChange={(e) => setMarketCacheTtlMs(e.target.value)}
            />
          </label>
          <label>
            RSS min refresh interval (ms)
            <input
              type="number"
              value={rssMinRefreshMs}
              onChange={(e) => setRssMinRefreshMs(e.target.value)}
            />
          </label>

          <h3>Weather</h3>
          <label>
            OpenWeather API key (optional if set in env)
            <input
              type="password"
              value={weatherApiKey}
              onChange={(e) => setWeatherApiKey(e.target.value)}
              placeholder={runtime?.hasWeatherApiKey ? 'Leave blank to keep current key' : 'Enter API key'}
              autoComplete="off"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={weatherFixedLocation}
              onChange={(e) => setWeatherFixedLocation(e.target.checked)}
            />{' '}
            Force fixed weather location
          </label>
          <label>
            Weather latitude
            <input
              type="text"
              value={weatherLat}
              onChange={(e) => setWeatherLat(e.target.value)}
              placeholder="35.2271"
            />
          </label>
          <label>
            Weather longitude
            <input
              type="text"
              value={weatherLon}
              onChange={(e) => setWeatherLon(e.target.value)}
              placeholder="-80.8431"
            />
          </label>

          <h3>GitHub sync behavior</h3>
          <label>
            <input
              type="checkbox"
              checked={githubSyncExcludeForks}
              onChange={(e) => setGithubSyncExcludeForks(e.target.checked)}
            />{' '}
            Exclude forked repositories
          </label>
          <label>
            <input
              type="checkbox"
              checked={githubSyncExcludeArchived}
              onChange={(e) => setGithubSyncExcludeArchived(e.target.checked)}
            />{' '}
            Exclude archived repositories
          </label>
          <label>
            GitHub API User-Agent
            <input
              type="text"
              value={githubApiUserAgent}
              onChange={(e) => setGithubApiUserAgent(e.target.value)}
              placeholder="AlruscoPortfolio/1.0 (github sync)"
            />
          </label>

          <h3>AI</h3>
          <label>
            OpenAI API key (optional if set in env)
            <input
              type="password"
              value={openAiApiKey}
              onChange={(e) => setOpenAiApiKey(e.target.value)}
              placeholder={runtime?.hasOpenAiApiKey ? 'Leave blank to keep current key' : 'Enter API key'}
              autoComplete="off"
            />
          </label>
          <label>
            OpenAI model
            <input
              type="text"
              value={openAiModel}
              onChange={(e) => setOpenAiModel(e.target.value)}
              placeholder="gpt-4o-mini"
            />
          </label>

          {runtimeError && <p className="error-text">{runtimeError}</p>}
          {runtimeMessage && <p className="success">{runtimeMessage}</p>}

          <div className="settings-github-actions">
            <button type="submit" className="btn btn-primary" disabled={runtimeSaving}>
              {runtimeSaving ? 'Saving…' : 'Save integration settings'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={runtimeSaving || !runtime?.hasMarketApiKey}
              onClick={() => void clearRuntimeKey('market')}
            >
              Remove stored market key
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={runtimeSaving || !runtime?.hasFinnhubApiKey}
              onClick={() => void clearRuntimeKey('finnhub')}
            >
              Remove stored Finnhub key
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={runtimeSaving || !runtime?.hasOpenAiApiKey}
              onClick={() => void clearRuntimeKey('openai')}
            >
              Remove stored OpenAI key
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={runtimeSaving || !runtime?.hasWeatherApiKey}
              onClick={() => void clearRuntimeKey('weather')}
            >
              Remove stored weather key
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
