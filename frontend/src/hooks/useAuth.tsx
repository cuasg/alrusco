import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'

export const SESSION_EXTENSION_MINUTES = [30, 60, 90, 120] as const
export type SessionExtensionMinutes = (typeof SESSION_EXTENSION_MINUTES)[number]

type User = { id: number; username: string } | null

type AuthContextValue = {
  user: User
  sessionExpiresAt: string | null
  loading: boolean
  refresh: () => Promise<void>
  extendSession: (minutes: SessionExtensionMinutes) => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) {
        setUser(null)
        setSessionExpiresAt(null)
      } else {
        const data = (await res.json()) as {
          user?: { id: number; username: string } | null
          sessionExpiresAt?: string | null
        }
        setUser(data.user ?? null)
        setSessionExpiresAt(data.sessionExpiresAt ?? null)
      }
    } finally {
      setLoading(false)
    }
  }

  async function extendSession(minutes: SessionExtensionMinutes): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/extend-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      })
      if (!res.ok) {
        return false
      }
      const data = (await res.json()) as { sessionExpiresAt?: string }
      if (data.sessionExpiresAt) {
        setSessionExpiresAt(data.sessionExpiresAt)
      }
      return true
    } catch {
      return false
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, sessionExpiresAt, loading, refresh, extendSession }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
