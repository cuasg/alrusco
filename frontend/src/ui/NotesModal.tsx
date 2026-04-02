import { useEffect } from 'react'
import { NotesPanel } from './NotesPanel'

type Props = {
  open: boolean
  onClose: () => void
}

export function NotesModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="notes-modal-backdrop modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="notes-modal notes-modal--resizable modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="notes-modal__header">
          <h2 id="notes-modal-title">Notes</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        <NotesPanel className="notes-widget--modal" />
      </div>
    </div>
  )
}
