import type { DashboardIconSpec } from '../ui/DashboardBrandIcon'
import { DashboardBrandIcon } from '../ui/DashboardBrandIcon'

type LanApp = {
  id: string
  name: string
  description: string
  icon: DashboardIconSpec
}

const lanApps: LanApp[] = [
  {
    id: 'home-assistant',
    name: 'Home Assistant',
    description: 'Home automation and dashboards',
    icon: { kind: 'simpleicons', slug: 'homeassistant', color: '18bcf2' },
  },
  {
    id: 'plant-monitor',
    name: 'Plant monitor',
    description: 'Plant health monitoring',
    icon: { kind: 'plant' },
  },
  {
    id: 'sonarr',
    name: 'Sonarr',
    description: 'Series management',
    icon: { kind: 'simpleicons', slug: 'sonarr', color: '00cc00' },
  },
  {
    id: 'radarr',
    name: 'Radarr',
    description: 'Movie management',
    icon: { kind: 'simpleicons', slug: 'radarr', color: 'ffcb13' },
  },
  {
    id: 'qbittorrent',
    name: 'qBittorrent',
    description: 'Torrent client',
    icon: { kind: 'simpleicons', slug: 'qbittorrent', color: '2f6f97' },
  },
  {
    id: 'deluge',
    name: 'Deluge',
    description: 'Alternate torrent client',
    icon: { kind: 'simpleicons', slug: 'deluge', color: '26689a' },
  },
]

export function DashboardPage() {
  return (
    <section className="page dashboard-page">
      <header className="page-header">
        <h1>Apps dashboard</h1>
        <p>After signing in, you can securely reach internal tools via this dashboard.</p>
      </header>
      <div className="cards-grid">
        {lanApps.map((app) => (
          <article key={app.id} className="card dashboard-app-card">
            <a
              className="dashboard-app-card-link"
              href={`/apps/${app.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <div className="dashboard-app-card-row">
                <div className="dashboard-app-logo-wrap">
                  <DashboardBrandIcon
                    spec={app.icon}
                    title={app.name}
                    className="dashboard-app-logo"
                  />
                </div>
                <div className="dashboard-app-card-text">
                  <h2 className="dashboard-app-card-title">{app.name}</h2>
                  {app.description && (
                    <p className="dashboard-app-card-desc">{app.description}</p>
                  )}
                </div>
              </div>
              <span className="dashboard-app-card-cta">Open →</span>
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
