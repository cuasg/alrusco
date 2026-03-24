export const PORTFOLIO_SECTION_KEYS = [
  'positioning',
  'summary',
  'experience',
  'msiSystems',
  'achievements',
  'skills',
  'education',
] as const

export type PortfolioSectionKey = (typeof PORTFOLIO_SECTION_KEYS)[number]

export type PortfolioSections = Record<PortfolioSectionKey, string>

export type PortfolioData = {
  displayName: string
  headshotUrl: string | null
  sections: PortfolioSections
}

export const PORTFOLIO_SECTION_LABELS: Record<PortfolioSectionKey, string> = {
  positioning: 'Positioning statement',
  summary: 'Professional summary',
  experience: 'Experience timeline',
  msiSystems: 'Systems & operational work',
  achievements: 'Impact highlights',
  skills: 'Skills',
  education: 'Education & certifications',
}

export function emptySections(): PortfolioSections {
  return {
    positioning: '',
    summary: '',
    experience: '',
    msiSystems: '',
    achievements: '',
    skills: '',
    education: '',
  }
}
