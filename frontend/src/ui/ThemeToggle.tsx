import { useCallback, useState } from 'react'
import { applyTheme, type ThemeMode, resolveInitialTheme } from '../lib/theme'

function readMode(): ThemeMode {
  const t = document.documentElement.dataset.theme
  if (t === 'light' || t === 'dark') return t
  return resolveInitialTheme()
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(readMode)

  const toggle = useCallback(() => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setMode(next)
  }, [mode])

  return (
    <button
      type="button"
      className={className ?? 'theme-toggle'}
      onClick={toggle}
      aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {mode === 'dark' ? '☀' : '☾'}
    </button>
  )
}
