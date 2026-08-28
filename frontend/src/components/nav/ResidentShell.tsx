import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { NotificationCenter } from '../NotificationCenter'
import { ThemeToggle } from '../ThemeToggle'
import { HeaderLogoutButton } from '../HeaderLogoutButton'
import { UserAvatar } from './UserAvatar'
import { UserMenuPopover } from './UserMenuPopover'
import { RESIDENT_NAV_CATEGORIES, type ResidentNavCategoryId } from './residentNavConfig'

interface ResidentShellProps {
  user: any
  onNavigateToPath: (path: string) => void
  onLogout: () => void
  children: ReactNode
}

function getResidentCategoryForPath(pathname: string): ResidentNavCategoryId {
  for (const cat of RESIDENT_NAV_CATEGORIES) {
    if (cat.children.some((child) => pathname === child.path || pathname.startsWith(child.path))) {
      return cat.id
    }
  }
  return 'general'
}

export function ResidentShell({
  user,
  onNavigateToPath,
  onLogout,
  children,
}: ResidentShellProps) {
  const location = useLocation()
  const [selectedCategory, setSelectedCategory] = useState<ResidentNavCategoryId>(() =>
    getResidentCategoryForPath(location.pathname)
  )
  const [hoveredCategory, setHoveredCategory] = useState<ResidentNavCategoryId | null>(null)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resident_nav_sidebar_collapsed') === 'true'
    }
    return false
  })
  const [isHoverExpanded, setIsHoverExpanded] = useState<boolean>(false)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false)

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const categoryHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userMenuTriggerRef = useRef<HTMLButtonElement | null>(null)
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
          localStorage.setItem('resident_nav_sidebar_collapsed', 'true')
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

  useEffect(() => {
    const cat = getResidentCategoryForPath(location.pathname)
    setSelectedCategory(cat)
    setHoveredCategory(null)
  }, [location.pathname])

  const handleCategoryMouseEnter = (catId: ResidentNavCategoryId) => {
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

    categoryHoverTimerRef.current = setTimeout(() => {
      setHoveredCategory(catId)
    }, 100)
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

  const handleCategoryClick = (catId: ResidentNavCategoryId) => {
    setSelectedCategory(catId)
    setHoveredCategory(null)
    if (isCollapsed) {
      setIsCollapsed(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem('resident_nav_sidebar_collapsed', 'false')
      }
    }
    const catObj = RESIDENT_NAV_CATEGORIES.find((c) => c.id === catId)
    if (catObj && catObj.children.length > 0) {
      const isAlreadyOnChildPath = catObj.children.some((child) => location.pathname.startsWith(child.path))
      if (!isAlreadyOnChildPath) {
        onNavigateToPath(catObj.children[0].path)
      }
    }
  }

  const handleChildClick = (path: string) => {
    if (hoveredCategory) {
      setSelectedCategory(hoveredCategory)
      setHoveredCategory(null)
    }
    onNavigateToPath(path)
    setIsMobileOpen(false)
  }

  const activeCategory = hoveredCategory ?? selectedCategory
  const currentCategoryObj = RESIDENT_NAV_CATEGORIES.find((cat) => cat.id === activeCategory)
  const currentChildObj = currentCategoryObj?.children.find((child) =>
    location.pathname === child.path || location.pathname.startsWith(child.path)
  )

  const isEffectiveCollapsed = isCollapsed && !isHoverExpanded
  const isHoverOverlay = isCollapsed && isHoverExpanded
  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Sakin'

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
      default:
        return null
    }
  }

  return (
    <div
      className={`management-shell-layout resident-shell-layout ${
        isCollapsed ? 'secondary-collapsed' : ''
      } ${isHoverOverlay ? 'hover-overlay-active' : ''}`}
    >
      <a className="skip-link" href="#resident-main-content">Ana içeriğe geç</a>
      {/* Primary 64px Icon Rail + Secondary 230px Sidebar Area */}
      <div
        ref={sidebarAreaRef}
        className="shell-sidebar-area"
        onMouseEnter={handleSidebarAreaMouseEnter}
        onMouseLeave={handleSidebarAreaMouseLeave}
      >
        {/* Rail */}
        <aside className="nav-rail" aria-label="Sakin Portalı Menüsü">
          <button
            type="button"
            className="nav-rail-brand"
            onClick={() => onNavigateToPath('/resident/home')}
            title="Sakin Portalı"
          >
            <span className="brand-mark">SY</span>
          </button>

          <nav className="nav-rail-categories">
            {RESIDENT_NAV_CATEGORIES.map((cat) => {
              const isActive = cat.id === activeCategory
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`nav-rail-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(cat.id)}
                  onMouseEnter={() => handleCategoryMouseEnter(cat.id)}
                  title={cat.label}
                  aria-label={cat.label}
                >
                  <span className="rail-btn-icon">{renderIcon(cat.iconName)}</span>
                  <span className="rail-btn-label">{cat.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Secondary Sidebar */}
        {currentCategoryObj && (
          <aside
            className={`nav-secondary-sidebar ${isEffectiveCollapsed ? 'collapsed' : ''} ${
              isHoverOverlay ? 'hover-overlay' : ''
            }`}
            aria-label={`${currentCategoryObj.label} menüsü`}
          >
            <div className="sidebar-header">
              <h2 className="sidebar-title">{currentCategoryObj.label}</h2>
              <button
                className="sidebar-collapse-btn"
                type="button"
                onClick={() => {
                  setIsCollapsed((prev) => {
                    const next = !prev
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('resident_nav_sidebar_collapsed', String(next))
                    }
                    return next
                  })
                  setIsHoverExpanded(false)
                }}
                aria-label={isCollapsed ? 'Yan menüyü genişlet' : 'Yan menüyü daralt'}
              >
                <svg className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            </div>

            <div className="sidebar-menu">
              {currentCategoryObj.children.map((child) => {
                const isActive = location.pathname === child.path || (child.path !== '/resident/home' && location.pathname.startsWith(child.path))
                return (
                  <button
                    key={child.id}
                    type="button"
                    className={`sidebar-menu-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleChildClick(child.path)}
                  >
                    <span className="btn-title">{child.label}</span>
                    {child.description && <span className="btn-desc">{child.description}</span>}
                  </button>
                )
              })}
            </div>
          </aside>
        )}
      </div>

      {/* Main Content Area + Top Utility Bar */}
      <div className="shell-main">
        <header className="nav-top-utility-bar">
          <div className="top-bar-left">
            <button
              className="mobile-menu-toggle-btn"
              type="button"
              aria-label="Menüyü aç"
              onClick={() => setIsMobileOpen((prev) => !prev)}
            >
              ☰
            </button>

            <nav className="top-bar-breadcrumb" aria-label="Konum bilgisi">
              <span className="breadcrumb-parent">Sakin Portalı</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{currentChildObj?.label || 'Ana Sayfa'}</span>
            </nav>
          </div>

          <div className="top-bar-right">
            <div className="topbar-utility-cluster">
              <NotificationCenter onNavigateToUrl={(url) => onNavigateToPath(url)} />
              <ThemeToggle />
              <button
                ref={userMenuTriggerRef}
                type="button"
                className={`top-bar-avatar-btn ${isUserMenuOpen ? 'active' : ''}`}
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-label="Kullanıcı Menüsü"
                aria-expanded={isUserMenuOpen}
                title={displayName}
              >
                <UserAvatar displayName={displayName} profileImageUrl={user?.profileImageUrl} size="sm" />
              </button>
            </div>
            <HeaderLogoutButton onActivate={onLogout} />
          </div>
        </header>

        <main id="resident-main-content" tabIndex={-1} className="shell-content">
          <div className="shell-page-content">
            {children}
          </div>
        </main>
      </div>

      {/* User Menu Popover */}
      <UserMenuPopover
        isOpen={isUserMenuOpen}
        onClose={() => setIsUserMenuOpen(false)}
        user={user}
        userRoles={user?.roles || ['RESIDENT']}
        onNavigateToView={(viewId) => {
          if (viewId === 'account') onNavigateToPath('/account')
          else if (viewId === 'settings') onNavigateToPath('/settings')
          else onNavigateToPath('/resident/home')
        }}
        onLogout={onLogout}
        triggerRef={userMenuTriggerRef}
        anchorPosition="topbar"
      />

      {/* Mobile Backdrop */}
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
