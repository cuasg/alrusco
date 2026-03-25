export const THEME_STORAGE_KEY = 'alrusco-theme'

export type ThemeMode = 'dark' | 'light'

export function getStoredTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return null
}

export function getPreferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function resolveInitialTheme(): ThemeMode {
  return getStoredTheme() ?? getPreferredTheme()
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}
