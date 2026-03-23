import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

type NavDropdownItem = {
  label: string
  href: string
}

type Props = {
  label: string
  items: NavDropdownItem[]
}

export function NavDropdown({ label, items }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

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

  return (
    <div className="nav-dropdown" ref={ref}>
      <button
        type="button"
        className="nav-link nav-dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
        <span className="nav-dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="nav-dropdown-menu" role="menu">
          {items.map((item) => (
            <Link key={item.href} to={item.href} className="nav-dropdown-item" role="menuitem">
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

