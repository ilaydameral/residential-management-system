import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'

interface ConfirmationDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  isLoading?: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
  children?: ReactNode
}

export function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Vazgeç',
  danger = false,
  isLoading = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmationDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
    }
  }, [])

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (!isLoading && event.target === event.currentTarget) onCancel()
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (!isLoading) onCancel()
      return
    }

    if (event.key === 'Enter') {
      const isTextEntry = event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement

      if (isTextEntry && !event.ctrlKey && !event.metaKey) {
        if (event.target instanceof HTMLInputElement) event.preventDefault()
        return
      }

      event.preventDefault()
      if (!isLoading && !confirmDisabled) onConfirm()
      return
    }

    if (event.key !== 'Tab') return
    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusableElements?.length) return

    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="confirmation-overlay" role="presentation" onMouseDown={handleBackdrop}>
      <div
        ref={dialogRef}
        className="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isLoading}
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{message}</p>
        {children}
        <div className="confirmation-actions">
          <button ref={cancelButtonRef} className="secondary-button" type="button" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'action-button danger-btn' : 'primary-button'}
            type="button"
            onClick={onConfirm}
            disabled={isLoading || confirmDisabled}
          >
            {isLoading ? 'İşlem yapılıyor...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
