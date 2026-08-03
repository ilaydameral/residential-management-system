import { useCallback, useEffect, useRef, useState } from 'react'

const UNSAVED_CHANGES_MESSAGE =
  'Kaydedilmemiş değişiklikleriniz var. Devam ederseniz değişiklikler kaybolacak.'

export function useUnsavedChangesGuard(isDirty: boolean) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const resolverRef = useRef<((shouldDiscard: boolean) => void) | null>(null)

  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    return () => {
      resolverRef.current?.(false)
      resolverRef.current = null
    }
  }, [])

  const requestDiscard = useCallback(
    (hasChanges = isDirty): Promise<boolean> => {
      if (!hasChanges) return Promise.resolve(true)

      return new Promise((resolve) => {
        resolverRef.current = resolve
        setIsDialogOpen(true)
      })
    },
    [isDirty]
  )

  const resolveDialog = (shouldDiscard: boolean) => {
    setIsDialogOpen(false)
    resolverRef.current?.(shouldDiscard)
    resolverRef.current = null
  }

  const unsavedChangesDialog = isDialogOpen ? (
    <div className="confirmation-overlay" role="presentation">
      <div
        className="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
        aria-describedby="unsaved-dialog-description"
      >
        <h2 id="unsaved-dialog-title">Kaydedilmemiş Değişiklikler</h2>
        <p id="unsaved-dialog-description">{UNSAVED_CHANGES_MESSAGE}</p>
        <div className="confirmation-actions">
          <button className="secondary-button" type="button" onClick={() => resolveDialog(false)}>
            Vazgeç
          </button>
          <button className="action-button danger-btn" type="button" onClick={() => resolveDialog(true)}>
            Değişiklikleri Sil ve Devam Et
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { requestDiscard, unsavedChangesDialog }
}
