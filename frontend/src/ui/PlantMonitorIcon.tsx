/** Decorative sprout / leaves for self-hosted plant monitor (no official mark). */
export function PlantMonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Stem */}
      <path
        d="M22 44h4v-14c-1.5 1-3.5 1.5-6 1.5v-3c4 0 7-2 9-5l2.5 2.5c-1.8 3.2-5 5.5-9.5 6.3V44z"
        fill="#15803d"
      />
      {/* Left leaf */}
      <ellipse cx="14" cy="22" rx="11" ry="17" fill="#4ade80" transform="rotate(-32 14 22)" />
      {/* Right leaf */}
      <ellipse cx="34" cy="22" rx="11" ry="17" fill="#22c55e" transform="rotate(32 34 22)" />
      {/* Highlight */}
      <ellipse cx="12" cy="18" rx="3" ry="6" fill="#bbf7d0" opacity="0.35" transform="rotate(-32 12 18)" />
    </svg>
  )
}
