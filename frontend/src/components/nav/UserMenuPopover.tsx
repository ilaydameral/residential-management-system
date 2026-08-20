import { useEffect, useRef } from 'react'
import { UserAvatar } from './UserAvatar'

interface UserMenuPopoverProps {
  isOpen: boolean
  onClose: () => void
  user: any
  userRoles: string[]
  onNavigateToView: (viewId: string) => void
  onLogout: () => void
  triggerRef?: React.RefObject<HTMLElement | null>
  anchorPosition?: 'topbar' | 'bottom-left'
}

const ROLE_LABEL_MAP: Record<string, string> = {
  ADMIN: 'Yönetici',
  MANAGER: 'Site Yöneticisi',
  RESIDENT: 'Sakin',
  TECHNICAL_STAFF: 'Teknik Personel',
}

export function getUserRoleLabel(roles: string[]): string {
  if (roles.includes('ADMIN')) return ROLE_LABEL_MAP.ADMIN
  if (roles.includes('MANAGER')) return ROLE_LABEL_MAP.MANAGER
  if (roles.includes('RESIDENT')) return ROLE_LABEL_MAP.RESIDENT
  if (roles.includes('TECHNICAL_STAFF')) return ROLE_LABEL_MAP.TECHNICAL_STAFF
  return roles[0] || 'Kullanıcı'
}

export function UserMenuPopover({
  isOpen,
  onClose,
  user,
  userRoles,
  onNavigateToView,
  onLogout,
  triggerRef,
  anchorPosition = 'bottom-left',
}: UserMenuPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Kullanıcı'
  const roleLabel = getUserRoleLabel(userRoles)

  // Listen for Outside Click & ESC Key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        triggerRef?.current?.focus()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className={`user-menu-popover anchor-${anchorPosition}`}
      role="menu"
      aria-label="Kullanıcı Menüsü"
      tabIndex={-1}
    >
      <div className="popover-header">
        <UserAvatar
          displayName={displayName}
          profileImageUrl={user?.profileImageUrl}
          size="md"
        />
        <div className="popover-user-details">
          <span className="popover-user-name">{displayName}</span>
          <span className="popover-role-badge">{roleLabel}</span>
        </div>
      </div>

      <div className="popover-divider" />

      <div className="popover-actions">
        <button
          type="button"
          className="popover-menu-item"
          role="menuitem"
          onClick={() => {
            onNavigateToView('account')
            onClose()
          }}
        >
          <svg className="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
          </svg>
          <span>Profilim</span>
        </button>

        <button
          type="button"
          className="popover-menu-item"
          role="menuitem"
          onClick={() => {
            onNavigateToView('settings')
            onClose()
          }}
        >
          <svg className="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
          </svg>
          <span>Ayarlar</span>
        </button>

        <div className="popover-divider" />

        <button
          type="button"
          className="popover-menu-item logout-item"
          role="menuitem"
          onClick={() => {
            onLogout()
            onClose()
          }}
        >
          <svg className="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" />
            <path d="M14 8l4 4-4 4M18 12H9" />
          </svg>
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  )
}
