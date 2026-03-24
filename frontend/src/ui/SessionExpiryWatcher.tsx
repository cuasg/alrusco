import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAuth,
  SESSION_EXTENSION_MINUTES,
  type SessionExtensionMinutes,
} from '../hooks/useAuth'

/** Show the prompt this many ms before the JWT/cookie expires */
const WARNING_LEAD_MS = 2 * 60 * 1000

export function SessionExpiryWatcher() {
  const { user, sessionExpiresAt, extendSession, refresh } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState<SessionExtensionMinutes>(30)
  const [extending, setExtending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const openRef = useRef(false)
  openRef.current = open

  useEffect(() => {
    if (!user || !sessionExpiresAt) {
      setOpen(false)
      return
    }

    const exp = new Date(sessionExpiresAt).getTime()
    const showAt = exp - WARNING_LEAD_MS

    const check = () => {
      if (openRef.current) return
      if (Date.now() >= showAt) {
        setOpen(true)
      }
    }

    check()
    const intervalId = window.setInterval(check, 5000)
    const delay = Math.max(0, showAt - Date.now())
    const timeoutId = window.setTimeout(check, delay)

    const onVis = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user, sessionExpiresAt])

  useEffect(() => {
    if (open) {
      setMinutes(30)
      setError(null)
    }
  }, [open])

  async function handleStayLoggedIn() {
    setError(null)
    setExtending(true)
    try {
      const ok = await extendSession(minutes)
      if (!ok) {
        setError('Could not extend session. Sign in again.')
        return
      }
      setOpen(false)
    } finally {
      setExtending(false)
    }
  }

  async function handleLogout() {
    setError(null)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      await refresh()
      setOpen(false)
      navigate('/', { replace: true })
    } catch {
      setError('Logout failed. Try again.')
    }
  }

  if (!open) return null

  return (
    <div
      className="modal-backdrop session-expiry-backdrop"
      role="presentation"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="modal session-expiry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expiry-title"
      >
        <h2 id="session-expiry-title">Session ending soon</h2>
        <p className="session-expiry-intro">
          Your login session is about to expire. Stay signed in for longer, or sign out now.
        </p>

        <fieldset className="session-expiry-fieldset">
          <legend className="session-expiry-legend">Session length if you stay signed in</legend>
          <div className="session-expiry-options">
            {SESSION_EXTENSION_MINUTES.map((m) => (
              <label key={m} className="session-expiry-option">
                <input
                  type="radio"
                  name="session-extension"
                  checked={minutes === m}
                  onChange={() => setMinutes(m)}
                />
                <span>{m} min</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions session-expiry-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void handleLogout()}
            disabled={extending}
          >
            Sign out
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleStayLoggedIn()}
            disabled={extending}
          >
            {extending ? 'Extending…' : 'Stay signed in'}
          </button>
        </div>
      </div>
    </div>
  )
}
