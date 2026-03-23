const lanApps = [
  {
    id: 'home-assistant',
    name: 'Home Assistant',
    description: 'Home automation and dashboards',
  },
  {
    id: 'plant-monitor',
    name: 'Plant monitor',
    description: 'Plant health monitoring',
  },
  {
    id: 'sonarr',
    name: 'Sonarr',
    description: 'Series management',
  },
  {
    id: 'radarr',
    name: 'Radarr',
    description: 'Movie management',
  },
  {
    id: 'qbittorrent',
    name: 'qBittorrent',
    description: 'Torrent client',
  },
  {
    id: 'deluge',
    name: 'Deluge',
    description: 'Alternate torrent client',
  },
]

export function DashboardPage() {
  return (
    <section className="page dashboard-page">
      <h1>Apps dashboard</h1>
      <p>After signing in, you can securely reach internal tools via this dashboard.</p>
      <div className="cards-grid">
        {lanApps.map((app) => (
          <article key={app.id} className="card">
            <h2>{app.name}</h2>
            {app.description && <p>{app.description}</p>}
            <a href={`/apps/${app.id}`} target="_blank" rel="noreferrer">
              Open
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

