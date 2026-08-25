import { UserAvatar } from './UserAvatar'
import { getUserRoleLabel } from './UserMenuPopover'
import { NAV_CATEGORIES, type NavCategoryId } from './navConfig'

interface SecondarySidebarProps {
  activeCategory: NavCategoryId
  activeView: string
  onSelectView: (viewId: string) => void
  isCollapsed: boolean
  isHoverOverlay?: boolean
  onToggleCollapse: () => void
  userRoles: string[]
  user?: any
  onToggleUserMenu?: () => void
  isUserMenuOpen?: boolean
  sidebarTriggerRef?: React.RefObject<HTMLButtonElement | null>
}

export function SecondarySidebar({
  activeCategory,
  activeView,
  onSelectView,
  isCollapsed,
  isHoverOverlay,
  onToggleCollapse,
  userRoles,
  user,
  onToggleUserMenu,
  isUserMenuOpen,
  sidebarTriggerRef,
}: SecondarySidebarProps) {
  const isAdmin = userRoles.includes('ADMIN')
  const isManager = userRoles.includes('MANAGER')
  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Kullanıcı'
  const roleLabel = getUserRoleLabel(userRoles)

  const currentCategoryObj = NAV_CATEGORIES.find((cat) => cat.id === activeCategory)
  if (!currentCategoryObj) return null

  const availableChildren = currentCategoryObj.children.filter((child) => {
    if (child.adminOnly && !isAdmin) return false
    if (child.managerOnly && !isManager) return false
    return true
  })

  return (
    <aside
      className={`nav-secondary-sidebar ${isCollapsed ? 'collapsed' : ''} ${isHoverOverlay ? 'hover-overlay' : ''}`}
      aria-label={`${currentCategoryObj.label} alt menüsü`}
    >
      <div className="sidebar-header">
        <h2 className="sidebar-title">{currentCategoryObj.label}</h2>
        <button
          className="sidebar-collapse-btn"
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Yan menüyü genişlet' : 'Yan menüyü daralt'}
          title={isCollapsed ? 'Yan menüyü genişlet' : 'Yan menüyü daralt'}
        >
          <svg
            className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <nav className="sidebar-menu">
        {availableChildren.map((item) => {
          const isActive = activeView === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-menu-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="btn-title">{item.label}</div>
              {item.description && <div className="btn-desc">{item.description}</div>}
            </button>
          )
        })}
      </nav>

      {onToggleUserMenu && !isCollapsed && (
        <div className="sidebar-footer">
          <button
            ref={sidebarTriggerRef}
            type="button"
            className={`sidebar-user-entry-btn ${isUserMenuOpen ? 'active' : ''}`}
            onClick={onToggleUserMenu}
            aria-label="Kullanıcı Menüsü"
            aria-expanded={isUserMenuOpen}
          >
            <UserAvatar displayName={displayName} profileImageUrl={user?.profileImageUrl} size="sm" />
            <div className="user-entry-info">
              <span className="user-entry-name">{displayName}</span>
              <span className="user-entry-role">{roleLabel}</span>
            </div>
          </button>
        </div>
      )}
    </aside>
  )
}
