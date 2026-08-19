import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmationDialog } from '../components/ConfirmationDialog'

const UNSAVED_CHANGES_MESSAGE =
  'Kaydedilmemiş değişiklikler var. Çıkmak istediğinize emin misiniz?'

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
    <ConfirmationDialog
      title="Kaydedilmemiş Değişiklikler"
      message={UNSAVED_CHANGES_MESSAGE}
      confirmLabel="Çık / Değişiklikleri Sil"
      cancelLabel="Vazgeç"
      danger
      onCancel={() => resolveDialog(false)}
      onConfirm={() => resolveDialog(true)}
    />
  ) : null

  return { requestDiscard, unsavedChangesDialog }
}
