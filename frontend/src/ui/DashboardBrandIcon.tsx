import { PlantMonitorIcon } from './PlantMonitorIcon'

export type DashboardIconSpec =
  | { kind: 'simpleicons'; slug: string; color: string }
  | { kind: 'plant' }

type Props = {
  spec: DashboardIconSpec
  title: string
  className?: string
}

/**
 * Brand marks via Simple Icons CDN (same-origin not required; icons are CC0).
 * @see https://github.com/simple-icons/simple-icons
 */
export function DashboardBrandIcon({ spec, title, className }: Props) {
  if (spec.kind === 'plant') {
    return <PlantMonitorIcon className={className} />
  }

  const src = `https://cdn.simpleicons.org/${spec.slug}/${spec.color}`
  return (
    <img
      className={className}
      src={src}
      alt=""
      width={36}
      height={36}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      title={title}
    />
  )
}
