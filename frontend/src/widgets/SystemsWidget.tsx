import type { WidgetRenderProps } from '../dashboard/WidgetRegistry'

type LinkGroup = { title: string; links: Array<{ label: string; href: string }> }

const GROUPS: LinkGroup[] = [
  {
    title: 'News',
    links: [
      { label: 'Reuters', href: 'https://www.reuters.com' },
      { label: 'WSJ', href: 'https://www.wsj.com' },
      { label: 'Bloomberg', href: 'https://www.bloomberg.com' },
      { label: 'AP News', href: 'https://apnews.com' },
    ],
  },
  {
    title: 'Tech',
    links: [
      { label: 'Hacker News', href: 'https://news.ycombinator.com' },
      { label: 'The Verge', href: 'https://www.theverge.com' },
      { label: 'GitHub', href: 'https://github.com' },
      { label: 'GitHub Status', href: 'https://status.github.com' },
    ],
  },
  {
    title: 'Automotive',
    links: [
      { label: 'Road & Track', href: 'https://www.roadandtrack.com' },
      { label: 'Car and Driver', href: 'https://www.caranddriver.com' },
      { label: 'MotorTrend', href: 'https://www.motortrend.com' },
    ],
  },
  {
    title: 'Shipping / Logistics',
    links: [
      { label: 'MarineTraffic', href: 'https://www.marinetraffic.com' },
      { label: 'VesselFinder', href: 'https://www.vesselfinder.com' },
      { label: 'FreightWaves', href: 'https://www.freightwaves.com' },
    ],
  },
]

export function SystemsWidget({ editMode }: WidgetRenderProps) {
  return (
    <div>
      <p className="hp-muted" style={{ marginTop: 0 }}>
        Quicklinks {editMode ? '(editable later)' : ''}
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <div className="hp-muted" style={{ fontSize: 12, marginBottom: 6 }}>
              {g.title}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {g.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

