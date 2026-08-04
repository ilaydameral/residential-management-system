import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

export interface RowAction {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

interface RowActionsMenuProps {
  primaryAction: RowAction
  secondaryActions?: RowAction[]
  label: string
}

export function RowActionsMenu({ primaryAction, secondaryActions = [], label }: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const openMenu = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const estimatedHeight = secondaryActions.length * 40 + 12
    const openAbove = window.innerHeight - rect.bottom < estimatedHeight + 12
    setMenuStyle(openAbove
      ? { right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.top + 6 }
      : { right: window.innerWidth - rect.right, top: rect.bottom + 6 })
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu()
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu(true)
      }
    }
    const handleViewportChange = () => closeMenu()

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    window.requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus())

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [isOpen])

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    let nextIndex = currentIndex
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length
    else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = items.length - 1
    else return
    event.preventDefault()
    items[nextIndex]?.focus()
  }

  const runAction = (action: RowAction) => {
    closeMenu()
    action.onSelect()
  }

  return (
    <div className="row-actions">
      <button
        className="row-primary-action"
        type="button"
        disabled={primaryAction.disabled}
        onClick={primaryAction.onSelect}
      >
        {primaryAction.label}
      </button>
      {secondaryActions.length > 0 && (
        <>
          <button
            ref={triggerRef}
            className="row-actions-trigger"
            type="button"
            aria-label={`${label} için diğer işlemler`}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            onClick={() => isOpen ? closeMenu() : openMenu()}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                openMenu()
              }
            }}
          >
            <span aria-hidden="true">•••</span>
          </button>
          {isOpen && createPortal(
            <div
              ref={menuRef}
              className="row-actions-menu"
              style={menuStyle}
              role="menu"
              aria-label={`${label} işlemleri`}
              onKeyDown={handleMenuKeyDown}
            >
              {secondaryActions.map((action) => (
                <button
                  key={action.label}
                  className={action.danger ? 'danger' : ''}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => runAction(action)}
                >
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )}
        </>
      )}
    </div>
  )
}
