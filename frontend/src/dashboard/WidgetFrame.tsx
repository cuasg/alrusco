import type { ReactNode } from 'react'

type Props = {
  title: string
  editMode: boolean
  children: ReactNode
  onRemove?: () => void
  onConfigure?: () => void
  /** Hide widget body (e.g. notes collapsed to header row). */
  compact?: boolean
  /** Extra controls in the header row (e.g. Collapse). */
  headerTrailing?: ReactNode
  /** Show drag handle in edit mode (hidden for docked widgets not on the grid). */
  showDragHandle?: boolean
}

export function WidgetFrame({
  title,
  editMode,
  children,
  onRemove,
  onConfigure,
  compact,
  headerTrailing,
  showDragHandle = true,
}: Props) {
  return (
    <article className={`card dash-widget${compact ? ' dash-widget--compact' : ''}`}>
      <header className="dash-widget-header">
        <div className="dash-widget-title">
          {editMode && showDragHandle && <span className="dash-drag-handle" aria-hidden="true">⋮⋮</span>}
          <h2>{title}</h2>
        </div>
        <div className="dash-widget-header-right">
          {headerTrailing}
          {editMode && (
            <div className="dash-widget-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onConfigure} disabled={!onConfigure}>
                Configure
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove} disabled={!onRemove}>
                Remove
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="dash-widget-body">{children}</div>
    </article>
  )
}
