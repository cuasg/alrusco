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
          className="nav-link nav-dropdown-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          ⚙
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

