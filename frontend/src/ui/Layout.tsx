import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { WeatherBadge } from './WeatherBadge'
import { useAuth } from '../hooks/useAuth'
import { AccountMenu } from './AccountMenu'
import { ChangePasswordModal } from './ChangePasswordModal'
import { NotesModal } from './NotesModal'
import { SessionExpiryWatcher } from './SessionExpiryWatcher'
import { ThemeToggle } from './ThemeToggle'

type Props = {
  children: ReactNode
}

export function Layout({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobilePwdOpen, setMobilePwdOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const navLinkClass = (path: string) =>
    location.pathname === path ? 'nav-link active' : 'nav-link'

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.classList.add('nav-mobile-open')
    } else {
      document.body.classList.remove('nav-mobile-open')
    }
    return () => document.body.classList.remove('nav-mobile-open')
  }, [mobileNavOpen])

  useEffect(() => {
    if (!mobileNavOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileNavOpen])

  useEffect(() => {
    if (!user) setNotesOpen(false)
  }, [user])

  async function handleMobileLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      await refresh()
      navigate('/', { replace: true })
      setMobileNavOpen(false)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-row">
          <div className="logo">
            <Link to="/" onClick={() => setMobileNavOpen(false)}>
              alrusco
            </Link>
          </div>

          <nav className="nav nav-desktop" aria-label="Main">
            <Link to="/" className={navLinkClass('/')}>
              Home
            </Link>
            <Link to="/portfolio" className={navLinkClass('/portfolio')}>
              Portfolio
            </Link>
            <Link to="/projects" className={navLinkClass('/projects')}>
              Projects
            </Link>
            <Link to="/photos" className={navLinkClass('/photos')}>
              Photos
            </Link>
            <Link to="/about" className={navLinkClass('/about')}>
              About
            </Link>
            {user && (
              <Link to="/links" className={navLinkClass('/links')}>
                Links
              </Link>
            )}
          </nav>

          <div className="nav-right nav-right-desktop">
            <ThemeToggle />
            <WeatherBadge />
            {user && (
              <button
                type="button"
                className={`nav-notes-btn${notesOpen ? ' nav-notes-btn--open' : ''}`}
                aria-label="Notes"
                title="Notes"
                aria-expanded={notesOpen}
                onClick={() => setNotesOpen((o) => !o)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
              </button>
            )}
            {user ? (
              <AccountMenu />
            ) : (
              <Link to="/login" className={navLinkClass('/login')}>
                Login
              </Link>
            )}
          </div>

          <div className="nav-mobile-bar">
            <ThemeToggle />
            <WeatherBadge />
            {user && (
              <button
                type="button"
                className={`nav-notes-btn${notesOpen ? ' nav-notes-btn--open' : ''}`}
                aria-label="Notes"
                title="Notes"
                aria-expanded={notesOpen}
                onClick={() => setNotesOpen((o) => !o)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="nav-burger"
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-panel"
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              <span className="nav-burger-box" aria-hidden="true">
                <span className="nav-burger-line" />
                <span className="nav-burger-line" />
                <span className="nav-burger-line" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Outside header so position:fixed is viewport-relative (header backdrop-filter would trap fixed children). */}
      {mobileNavOpen && (
        <button
          type="button"
          className="nav-mobile-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <nav
        id="mobile-nav-panel"
        className={`nav-mobile-panel ${mobileNavOpen ? 'nav-mobile-panel--open' : ''}`}
        aria-hidden={!mobileNavOpen}
        aria-label="Mobile navigation"
      >
        <div className="nav-mobile-inner">
          <Link to="/" className={navLinkClass('/')} onClick={() => setMobileNavOpen(false)}>
            Home
          </Link>
          <Link
            to="/portfolio"
            className={navLinkClass('/portfolio')}
            onClick={() => setMobileNavOpen(false)}
          >
            Portfolio
          </Link>
          <Link
            to="/projects"
            className={navLinkClass('/projects')}
            onClick={() => setMobileNavOpen(false)}
          >
            Projects
          </Link>
          <Link to="/photos" className={navLinkClass('/photos')} onClick={() => setMobileNavOpen(false)}>
            Photos
          </Link>
          <Link
            to="/about"
            className={navLinkClass('/about')}
            onClick={() => setMobileNavOpen(false)}
          >
            About
          </Link>

          {user && (
            <Link
              to="/links"
              className={navLinkClass('/links')}
              onClick={() => setMobileNavOpen(false)}
            >
              Links
            </Link>
          )}

          <div className="nav-mobile-divider" aria-hidden="true" />

          {user ? (
            <div className="nav-mobile-account">
              <p className="nav-mobile-user">
                Signed in as <strong>{user.username}</strong>
              </p>
              <Link
                to="/settings"
                className="nav-mobile-action nav-mobile-action--link"
                onClick={() => setMobileNavOpen(false)}
              >
                Settings
              </Link>
              <button
                type="button"
                className="nav-mobile-action"
                onClick={() => {
                  setMobileNavOpen(false)
                  setMobilePwdOpen(true)
                }}
              >
                Change password
              </button>
              <button
                type="button"
                className="nav-mobile-action nav-mobile-action--danger"
                onClick={handleMobileLogout}
                disabled={loggingOut}
              >
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className={navLinkClass('/login')}
              onClick={() => setMobileNavOpen(false)}
            >
              Login
            </Link>
          )}
        </div>
      </nav>

      <ChangePasswordModal open={mobilePwdOpen} onClose={() => setMobilePwdOpen(false)} />
      {user ? <NotesModal open={notesOpen} onClose={() => setNotesOpen(false)} /> : null}
      <SessionExpiryWatcher />
      <main className={location.pathname === '/' ? 'app-main app-main--dashboard' : 'app-main'}>
        {children}
      </main>
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} alrusco</span>
      </footer>
    </div>
  )
}

