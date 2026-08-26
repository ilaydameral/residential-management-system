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
  const [selectedCategory, setSelectedCategory] = useState<NavCategoryId>(() => getCategoryForView(activeView))
  const [hoveredCategory, setHoveredCategory] = useState<NavCategoryId | null>(null)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nav_sidebar_collapsed') === 'true'
    }
    return false
  })
  const [isHoverExpanded, setIsHoverExpanded] = useState<boolean>(false)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  const [activeMenuAnchor, setActiveMenuAnchor] = useState<'topbar' | 'sidebar' | 'rail' | null>(null)

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const categoryHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const railTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sidebarTriggerRef = useRef<HTMLButtonElement | null>(null)
  const topbarTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sidebarAreaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (categoryHoverTimerRef.current) clearTimeout(categoryHoverTimerRef.current)
    }
  }, [])

  // Close manually open sidebar on outside click
  useEffect(() => {
    if (isCollapsed) return

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (
        target instanceof Element &&
        target.closest('.management-drawer, .management-drawer-backdrop, .confirmation-overlay, .modal-card, .user-menu-popover')
      ) {
        return
      }
      if (sidebarAreaRef.current && !sidebarAreaRef.current.contains(target)) {
        setIsCollapsed(true)
        if (typeof window !== 'undefined') {
          localStorage.setItem('nav_sidebar_collapsed', 'true')
        }
        setIsHoverExpanded(false)
        setHoveredCategory(null)
      }
    }

    document.addEventListener('click', handleOutsideClick)
    return () => {
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [isCollapsed])

  // Sync selectedCategory when activeView changes via routing / search
  useEffect(() => {
    const cat = getCategoryForView(activeView)
    setSelectedCategory(cat)
    setHoveredCategory(null)
  }, [activeView, location.pathname])

  const handleCategoryMouseEnter = (catId: NavCategoryId) => {
    if (categoryHoverTimerRef.current) {
      clearTimeout(categoryHoverTimerRef.current)
      categoryHoverTimerRef.current = null
    }

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }

    if (isCollapsed) {
      setIsHoverExpanded(true)
    }

    // Hover-intent delay (~100ms)
    categoryHoverTimerRef.current = setTimeout(() => {
      setHoveredCategory(catId)
    }, 100)
  }

  const handleCategoryMouseLeave = () => {
    if (categoryHoverTimerRef.current) {
      clearTimeout(categoryHoverTimerRef.current)
      categoryHoverTimerRef.current = null
    }
  }

  const handleSidebarAreaMouseEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    if (isCollapsed) {
      setIsHoverExpanded(true)
    }
  }

  const handleSidebarAreaMouseLeave = () => {
    if (categoryHoverTimerRef.current) {
      clearTimeout(categoryHoverTimerRef.current)
      categoryHoverTimerRef.current = null
    }

    if (isCollapsed) {
      hoverTimerRef.current = setTimeout(() => {
        setIsHoverExpanded(false)
        setHoveredCategory(null)
      }, 120)
    } else {
      setHoveredCategory(null)
    }
  }

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

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('nav_sidebar_collapsed', String(next))
      }
      return next
    })
    setIsHoverExpanded(false)
    setHoveredCategory(null)
  }

  const handleSelectCategory = (catId: NavCategoryId) => {
    setSelectedCategory(catId)
    setHoveredCategory(null)

    if (isCollapsed) {
      setIsCollapsed(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem('nav_sidebar_collapsed', 'false')
      }
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

  const handleSelectView = (viewId: string) => {
    if (hoveredCategory) {
      setSelectedCategory(hoveredCategory)
      setHoveredCategory(null)
    }
    onNavigateToView(viewId)
    setIsMobileOpen(false)
  }

  const activeCategory = hoveredCategory ?? selectedCategory
  const isEffectiveCollapsed = isCollapsed && !isHoverExpanded
  const isHoverOverlay = isCollapsed && isHoverExpanded

  return (
    <div
      className={`management-shell-layout ${
        isCollapsed ? 'secondary-collapsed' : ''
      } ${isHoverOverlay ? 'hover-overlay-active' : ''}`}
    >
      {/* Primary 64px Icon Rail + Secondary 230px Sidebar Area */}
      <div
        ref={sidebarAreaRef}
        className="shell-sidebar-area"
        onMouseEnter={handleSidebarAreaMouseEnter}
        onMouseLeave={handleSidebarAreaMouseLeave}
      >
        <NavigationRail
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          onCategoryMouseEnter={handleCategoryMouseEnter}
          onCategoryMouseLeave={handleCategoryMouseLeave}
          userRoles={userRoles}
          user={user}
          onToggleUserMenu={() => toggleUserMenu('rail')}
          isUserMenuOpen={activeMenuAnchor === 'rail'}
          triggerRef={railTriggerRef}
        />

        <SecondarySidebar
          activeCategory={activeCategory}
          activeView={activeView}
          onSelectView={handleSelectView}
          isCollapsed={isEffectiveCollapsed}
          isHoverOverlay={isHoverOverlay}
          onToggleCollapse={handleToggleCollapse}
          userRoles={userRoles}
          user={user}
          onToggleUserMenu={() => toggleUserMenu('sidebar')}
          isUserMenuOpen={activeMenuAnchor === 'sidebar'}
          sidebarTriggerRef={sidebarTriggerRef}
        />
      </div>

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
          <div className="shell-page-content">
            {children}
          </div>
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
