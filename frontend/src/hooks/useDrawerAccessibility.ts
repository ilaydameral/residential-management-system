import { useEffect, useRef, type RefObject } from 'react'

interface DrawerAccessibilityOptions {
  isOpen: boolean
  onClose: () => void
  enableSaveShortcut?: boolean
  isSaving?: boolean
}

export function useDrawerAccessibility({
  isOpen,
  onClose,
  enableSaveShortcut = true,
  isSaving = false,
}: DrawerAccessibilityOptions): RefObject<HTMLElement | null> {
  const drawerRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const isSavingRef = useRef(isSaving)
  const enableSaveShortcutRef = useRef(enableSaveShortcut)
  onCloseRef.current = onClose
  isSavingRef.current = isSaving
  enableSaveShortcutRef.current = enableSaveShortcut

  useEffect(() => {
    if (!isOpen) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusInitialElement = () => {
      const drawer = drawerRef.current
      if (!drawer) return
      const target = drawer.querySelector<HTMLElement>(
        '[data-drawer-initial-focus], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'
      )
      ;(target ?? drawer).focus()
    }
    const frameId = window.requestAnimationFrame(focusInitialElement)
    const drawerForm = drawerRef.current?.querySelector<HTMLFormElement>('form')
    const handleInvalid = (event: Event) => {
      if (event.target instanceof HTMLElement) {
        window.requestAnimationFrame(() => event.target instanceof HTMLElement && event.target.focus())
      }
    }
    drawerForm?.addEventListener('invalid', handleInvalid, true)

    const handleKeyDown = (event: KeyboardEvent) => {
      const drawer = drawerRef.current
      if (!drawer || document.querySelector('.confirmation-overlay')) return
      const openDrawers = Array.from(document.querySelectorAll<HTMLElement>('.management-drawer'))
      if (openDrawers.at(-1) !== drawer) return

      if (event.key === 'Escape') {
        const searchableSelect = event.target instanceof HTMLElement
          ? event.target.closest('.searchable-select-container')
          : null
        if (searchableSelect?.querySelector('[aria-expanded="true"]')) return
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        if (!enableSaveShortcutRef.current || isSavingRef.current) return
        const form = drawer.querySelector<HTMLFormElement>('form')
        if (!form) return
        event.preventDefault()
        form.requestSubmit()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute('hidden'))
      if (focusable.length === 0) {
        event.preventDefault()
        drawer.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frameId)
      document.removeEventListener('keydown', handleKeyDown)
      drawerForm?.removeEventListener('invalid', handleInvalid, true)
      openerRef.current?.focus()
    }
  }, [isOpen])

  return drawerRef
}
