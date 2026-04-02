import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChangePasswordModal } from './ChangePasswordModal'
import { useAuth } from '../hooks/useAuth'

export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const { user, refresh } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function handleChangePasswordClick() {
    setOpen(false)
    setShowModal(true)
  }

  async function handleLogoutClick() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!res.ok) {
        // best-effort logout; still refresh auth state
      }
      await refresh()
      setOpen(false)
      navigate('/', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      <div className="account-menu" ref={ref}>
        <button
          type="button"
          className="nav-link nav-dropdown-trigger account-menu-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          title="Account"
          onClick={() => setOpen((prev) => !prev)}
        >
          <svg
            className="account-menu-gear"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        {open && (
          <div className="nav-dropdown-menu account-menu-dropdown" role="menu">
            {user && (
              <>
                <div className="nav-dropdown-item account-menu-item account-menu-user" aria-disabled="true">
                  Signed in as <span className="account-menu-username">{user.username}</span>
                </div>
                <div className="account-menu-divider" aria-hidden="true" />
              </>
            )}
            <Link
              to="/settings"
              className="nav-dropdown-item account-menu-item account-menu-link"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
            <button
              type="button"
              className="nav-dropdown-item account-menu-item"
              onClick={handleChangePasswordClick}
            >
              Change password
            </button>
            <button
              type="button"
              className="nav-dropdown-item account-menu-item"
              onClick={handleLogoutClick}
              disabled={loggingOut}
            >
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        )}
      </div>
      <ChangePasswordModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}

