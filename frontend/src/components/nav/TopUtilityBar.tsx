import type { GlobalSearchItem } from '../../types'
import { HeaderGlobalSearchButton } from '../HeaderGlobalSearchButton'
import { HeaderLogoutButton } from '../HeaderLogoutButton'
import { NotificationCenter } from '../NotificationCenter'
import { ThemeToggle } from '../ThemeToggle'
import { UserAvatar } from './UserAvatar'
import { NAV_CATEGORIES, type NavCategoryId } from './navConfig'

interface TopUtilityBarProps {
  activeCategory: NavCategoryId
  activeView: string
  user?: any
  userRoles?: string[]
  onOpenSearch: () => void
  onCloseSearch: () => void
  onSelectSearchResult: (item: GlobalSearchItem) => void
  isSearchOpen: boolean
  onNavigateToView: (viewId: string) => void
  onLogout: () => void
  onToggleMobileMenu?: () => void
  onToggleUserMenu?: () => void
  isUserMenuOpen?: boolean
  topbarTriggerRef?: React.RefObject<HTMLButtonElement | null>
}

export function TopUtilityBar({
  activeCategory,
  activeView,
  user,
  onOpenSearch,
  onCloseSearch,
  onSelectSearchResult,
  isSearchOpen,
  onNavigateToView,
  onLogout,
  onToggleMobileMenu,
  onToggleUserMenu,
  isUserMenuOpen,
  topbarTriggerRef,
}: TopUtilityBarProps) {
  const currentCategory = NAV_CATEGORIES.find((cat) => cat.id === activeCategory)
  const currentChild = currentCategory?.children.find((child) => child.id === activeView)
  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Kullanıcı'

  return (
    <header className="nav-top-utility-bar">
      <div className="top-bar-left">
        {onToggleMobileMenu && (
          <button
            className="mobile-menu-toggle-btn"
            type="button"
            aria-label="Menüyü aç"
            onClick={onToggleMobileMenu}
          >
            ☰
          </button>
        )}
        <nav className="top-bar-breadcrumb" aria-label="Konum bilgisi">
          {currentCategory && currentChild ? (
            <>
              <span className="breadcrumb-parent">{currentCategory.label}</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{currentChild.label}</span>
            </>
          ) : (
            <span className="breadcrumb-current">{currentChild?.label || 'Yönetim Paneli'}</span>
          )}
        </nav>
      </div>

      <div className="top-bar-right">
        <HeaderGlobalSearchButton
          isOpen={isSearchOpen}
          onOpen={onOpenSearch}
          onClose={onCloseSearch}
          onSelectResult={onSelectSearchResult}
        />
        <div className="topbar-utility-cluster">
          <NotificationCenter onNavigateToView={(view) => onNavigateToView(view)} />
          <ThemeToggle />
          {onToggleUserMenu && (
            <button
              ref={topbarTriggerRef}
              type="button"
              className={`top-bar-avatar-btn ${isUserMenuOpen ? 'active' : ''}`}
              onClick={onToggleUserMenu}
              aria-label="Kullanıcı Menüsü"
              aria-expanded={isUserMenuOpen}
              title={displayName}
            >
              <UserAvatar displayName={displayName} profileImageUrl={user?.profileImageUrl} size="sm" />
            </button>
          )}
        </div>
        <HeaderLogoutButton onActivate={onLogout} />
      </div>
    </header>
  )
}
