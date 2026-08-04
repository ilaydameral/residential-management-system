import { useEffect, type MouseEvent } from 'react'

interface ConfirmationDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Vazgeç',
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onCancel()
  }

  return (
    <div className="confirmation-overlay" role="presentation" onMouseDown={handleBackdrop}>
      <div
        className="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
      >
        <h2 id="confirmation-dialog-title">{title}</h2>
        <p id="confirmation-dialog-description">{message}</p>
        <div className="confirmation-actions">
          <button className="secondary-button" type="button" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'action-button danger-btn' : 'primary-button'}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
