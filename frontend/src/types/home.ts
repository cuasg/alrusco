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

/** Defaults aligned with the public homepage; admin/API can override hero + highlights. */
export const FALLBACK_HOME: HomeConfig = {
  eyebrow: 'Systems · Building · Practice',
  heading: 'I build systems, solve problems, and make things work better.',
  tagline:
    "I'm focused on building, improving, and connecting systems — from home lab environments and web infrastructure to practical, real-world workflows.",
  highlights: [
    {
      title: 'Systems & Infrastructure',
      description:
        'Building and managing containerized environments, self-hosted services, reverse proxies, secure access, and reliable home lab systems.',
    },
    {
      title: 'Automation & Problem Solving',
      description:
        'Debugging broken workflows, connecting tools that do not naturally fit together, and turning messy manual processes into structured, repeatable systems.',
    },
    {
      title: 'Web & Application Development',
      description:
        'Designing practical web interfaces, working with APIs and backend logic, and building tools that are usable, purposeful, and grounded in real needs.',
    },
  ],
  bannerImageUrl: null,
}
