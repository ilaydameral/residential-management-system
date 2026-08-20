import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { GlobalSearchItem } from '../../types'
import { NavigationRail } from './NavigationRail'
import { SecondarySidebar } from './SecondarySidebar'
import { TopUtilityBar } from './TopUtilityBar'
import { UserMenuPopover } from './UserMenuPopover'
import { NAV_CATEGORIES, type NavCategoryId } from './navConfig'

interface ManagementShellProps {
  user: any
  userRoles: string[]
  activeView: string
  onNavigateToView: (viewId: string) => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  onSelectSearchResult: (item: GlobalSearchItem) => void
  isSearchOpen: boolean
  onLogout: () => void
  children: ReactNode
}

function getCategoryForView(viewId: string): NavCategoryId {
  for (const cat of NAV_CATEGORIES) {
    if (cat.children.some((child) => child.id === viewId)) {
      return cat.id
    }
  }
  return 'general'
}

export function ManagementShell({
  user,
  userRoles,
  activeView,
  onNavigateToView,
  onOpenSearch,
  onCloseSearch,
  onSelectSearchResult,
  isSearchOpen,
  onLogout,
  children,
}: ManagementShellProps) {
  const location = useLocation()
  const [activeCategory, setActiveCategory] = useState<NavCategoryId>(() => getCategoryForView(activeView))
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nav_secondary_collapsed') === 'true'
    }
    return false
  })
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  const [activeMenuAnchor, setActiveMenuAnchor] = useState<'topbar' | 'sidebar' | 'rail' | null>(null)

  const railTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sidebarTriggerRef = useRef<HTMLButtonElement | null>(null)
  const topbarTriggerRef = useRef<HTMLButtonElement | null>(null)

  const toggleUserMenu = (anchor: 'topbar' | 'sidebar' | 'rail') => {
    onCloseSearch()
    setActiveMenuAnchor((prev) => (prev === anchor ? null : anchor))
  }

  const handleOpenSearchWithCoexistence = () => {
    setActiveMenuAnchor(null)
    onOpenSearch()
  }

  const activeTriggerRef =
    activeMenuAnchor === 'topbar'
      ? topbarTriggerRef
      : activeMenuAnchor === 'sidebar'
      ? sidebarTriggerRef
      : railTriggerRef

  // Sync activeCategory when activeView changes via routing / search
  useEffect(() => {
    const cat = getCategoryForView(activeView)
    setActiveCategory(cat)
  }, [activeView, location.pathname])

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('nav_secondary_collapsed', String(next))
      }
      return next
    })
  }

  const handleSelectCategory = (catId: NavCategoryId) => {
    setActiveCategory(catId)
    if (isCollapsed) {
      setIsCollapsed(false)
    }

    const catObj = NAV_CATEGORIES.find((c) => c.id === catId)
    if (catObj && catObj.children.length > 0) {
      const isAlreadyInCat = catObj.children.some((child) => child.id === activeView)
      if (!isAlreadyInCat) {
        const isAdmin = userRoles.includes('ADMIN')
        const isManager = userRoles.includes('MANAGER')

        const firstValidChild = catObj.children.find((child) => {
          if (child.adminOnly && !isAdmin) return false
          if (child.managerOnly && !isManager) return false
          return true
        })

        if (firstValidChild) {
          onNavigateToView(firstValidChild.id)
        }
      }
    }
  }

  return (
    <div className={`management-shell-layout ${isCollapsed ? 'secondary-collapsed' : ''}`}>
      {/* Primary 64px Icon Rail */}
      <NavigationRail
        activeCategory={activeCategory}
        onSelectCategory={handleSelectCategory}
        userRoles={userRoles}
        user={user}
        onToggleUserMenu={() => toggleUserMenu('rail')}
        isUserMenuOpen={activeMenuAnchor === 'rail'}
        triggerRef={railTriggerRef}
      />

      {/* Secondary 230px Contextual Sidebar */}
      <SecondarySidebar
        activeCategory={activeCategory}
        activeView={activeView}
        onSelectView={(v) => {
          onNavigateToView(v)
          setIsMobileOpen(false)
        }}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        userRoles={userRoles}
        user={user}
        onToggleUserMenu={() => toggleUserMenu('sidebar')}
        isUserMenuOpen={activeMenuAnchor === 'sidebar'}
        sidebarTriggerRef={sidebarTriggerRef}
      />

      {/* Main Content Area + Top Utility Bar */}
      <div className="shell-main">
        <TopUtilityBar
          activeCategory={activeCategory}
          activeView={activeView}
          user={user}
          userRoles={userRoles}
          onOpenSearch={handleOpenSearchWithCoexistence}
          onCloseSearch={onCloseSearch}
          onSelectSearchResult={onSelectSearchResult}
          isSearchOpen={isSearchOpen}
          onNavigateToView={onNavigateToView}
          onLogout={onLogout}
          onToggleMobileMenu={() => setIsMobileOpen((prev) => !prev)}
          onToggleUserMenu={() => toggleUserMenu('topbar')}
          isUserMenuOpen={activeMenuAnchor === 'topbar'}
          topbarTriggerRef={topbarTriggerRef}
        />

        <main id="main-content" className="shell-content">
          {children}
        </main>
      </div>

      {/* User Menu Popover */}
      <UserMenuPopover
        isOpen={Boolean(activeMenuAnchor)}
        onClose={() => setActiveMenuAnchor(null)}
        user={user}
        userRoles={userRoles}
        onNavigateToView={onNavigateToView}
        onLogout={onLogout}
        triggerRef={activeTriggerRef}
        anchorPosition={activeMenuAnchor === 'topbar' ? 'topbar' : 'bottom-left'}
      />

      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="shell-mobile-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Menüyü kapat"
        />
      )}
    </div>
  )
}
