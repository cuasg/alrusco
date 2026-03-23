import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { NavDropdown } from './NavDropdown'
import { WeatherBadge } from './WeatherBadge'
import { useAuth } from '../hooks/useAuth'
import { AccountMenu } from './AccountMenu'
import { ChangePasswordModal } from './ChangePasswordModal'

const projectLinks = [
  { label: 'All projects', href: '/projects' },
  { label: 'Infrastructure', href: '/projects?category=infra' },
  { label: 'Applications', href: '/projects?category=apps' },
  { label: 'Open source', href: '/projects?category=oss' },
] as const

const photoLinks = [
  { label: 'All photos', href: '/photos' },
  { label: 'Infra snapshots', href: '/photos?category=infra' },
  { label: 'Places', href: '/photos?category=places' },
  { label: 'People', href: '/photos?category=people' },
] as const

type Props = {
  children: ReactNode
}

export function Layout({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobilePwdOpen, setMobilePwdOpen] = useState(false)
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
            <NavDropdown label="Projects" items={[...projectLinks]} />
            <NavDropdown label="Photos" items={[...photoLinks]} />
            {user && (
              <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                Dashboard
              </Link>
            )}
          </nav>

          <div className="nav-right nav-right-desktop">
            <WeatherBadge />
            {user ? (
              <AccountMenu />
            ) : (
              <Link to="/login" className={navLinkClass('/login')}>
                Login
              </Link>
            )}
          </div>

          <div className="nav-mobile-bar">
            <WeatherBadge />
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

          <details className="nav-mobile-details">
            <summary className="nav-mobile-summary">Projects</summary>
            <div className="nav-mobile-sub">
              {projectLinks.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="nav-mobile-sublink"
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>

          <details className="nav-mobile-details">
            <summary className="nav-mobile-summary">Photos</summary>
            <div className="nav-mobile-sub">
              {photoLinks.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="nav-mobile-sublink"
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>

          {user && (
            <Link
              to="/dashboard"
              className={navLinkClass('/dashboard')}
              onClick={() => setMobileNavOpen(false)}
            >
              Dashboard
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
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} alrusco</span>
      </footer>
    </div>
  )
}

