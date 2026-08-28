import { UserAvatar } from './UserAvatar'
import { NAV_CATEGORIES, type NavCategoryId } from './navConfig'

interface NavigationRailProps {
  activeCategory: NavCategoryId
  onSelectCategory: (categoryId: NavCategoryId) => void
  onCategoryMouseEnter?: (categoryId: NavCategoryId) => void
  onCategoryMouseLeave?: () => void
  userRoles: string[]
  user?: any
  onToggleUserMenu?: () => void
  isUserMenuOpen?: boolean
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

export function NavigationRail({
  activeCategory,
  onSelectCategory,
  onCategoryMouseEnter,
  onCategoryMouseLeave,
  userRoles,
  user,
  onToggleUserMenu,
  isUserMenuOpen,
  triggerRef,
}: NavigationRailProps) {
  const isAdmin = userRoles.includes('ADMIN')
  const isManager = userRoles.includes('MANAGER')
  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Kullanıcı'

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'home':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        )
      case 'building':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
          </svg>
        )
      case 'users':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )
      case 'wallet':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V7" />
            <path d="M16 14h.01" />
          </svg>
        )
      case 'tools':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        )
      case 'settings':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <aside className="nav-rail" aria-label="Ana Menü">
      <div className="nav-rail-brand">
        <span className="brand-mark">SY</span>
      </div>

      <nav className="nav-rail-categories">
        {NAV_CATEGORIES.map((cat) => {
          const availableChildren = cat.children.filter((child) => {
            if (child.adminOnly && !isAdmin) return false
            if (child.managerOnly && !isManager) return false
            return true
          })

          if (availableChildren.length === 0) return null

          const isActive = activeCategory === cat.id

          return (
            <button
              key={cat.id}
              type="button"
              className={`nav-rail-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectCategory(cat.id)}
              onMouseEnter={() => onCategoryMouseEnter?.(cat.id)}
              onMouseLeave={() => onCategoryMouseLeave?.()}
              aria-label={cat.label}
              title={cat.label}
            >
              <div className="rail-btn-icon">{renderIcon(cat.iconName)}</div>
              <span className="rail-btn-label">{cat.label}</span>
            </button>
          )
        })}
      </nav>

      {onToggleUserMenu && (
        <div className="nav-rail-footer">
          <button
            ref={triggerRef}
            type="button"
            className={`nav-rail-avatar-btn ${isUserMenuOpen ? 'active' : ''}`}
            onClick={onToggleUserMenu}
            aria-label="Kullanıcı Menüsü"
            aria-expanded={isUserMenuOpen}
            title={displayName}
          >
            <UserAvatar displayName={displayName} profileImageUrl={user?.profileImageUrl} size="sm" />
          </button>
        </div>
      )}
    </aside>
  )
}
