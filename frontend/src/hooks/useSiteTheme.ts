import { useEffect, useState } from 'react'

export type SiteThemeMode = 'light' | 'dark'

export function useSiteTheme(): SiteThemeMode {
  const [mode, setMode] = useState<SiteThemeMode>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
      ? 'light'
      : 'dark'
  )

  useEffect(() => {
    const el = document.documentElement
    const sync = () => {
      setMode(el.dataset.theme === 'light' ? 'light' : 'dark')
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return mode
}
