import type { DashboardConfig } from './types'

export async function fetchPublicDashboard(): Promise<DashboardConfig | null> {
  const res = await fetch('/api/public/dashboard')
  if (!res.ok) return null
  return (await res.json()) as DashboardConfig
}

export async function fetchAdminDashboard(): Promise<DashboardConfig | null> {
  const res = await fetch('/api/admin/dashboard', { credentials: 'include' })
  if (!res.ok) return null
  return (await res.json()) as DashboardConfig
}

export async function saveAdminDashboard(config: DashboardConfig): Promise<boolean> {
  const res = await fetch('/api/admin/dashboard', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  return res.ok
}

