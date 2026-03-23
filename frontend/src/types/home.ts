export type HomeHighlight = {
  title: string
  description: string
}

export type HomeConfig = {
  eyebrow: string
  heading: string
  tagline: string
  highlights: HomeHighlight[]
  bannerImageUrl?: string | null
}

export const FALLBACK_HOME: HomeConfig = {
  eyebrow: 'Homelab · Infrastructure · Applications',
  heading: 'Designing reliable systems at home and at work.',
  tagline:
    'I build and operate secure, observable infrastructure in my homelab and in production. This site is both my portfolio and the front door to my personal tools.',
  highlights: [
    {
      title: 'Infrastructure',
      description:
        'Clustered storage, virtualization, and networking designed for resilience, observability, and easy recovery.',
    },
    {
      title: 'Applications',
      description:
        'Internal dashboards, automations, and tools that make day-to-day operations smoother and more transparent.',
    },
    {
      title: 'Practice & learning',
      description:
        'Experiments, labs, and write-ups focused on doing things the right way instead of the quickest way.',
    },
  ],
  bannerImageUrl: null,
}

