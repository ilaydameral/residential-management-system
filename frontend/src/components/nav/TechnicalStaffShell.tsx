import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { NotificationCenter } from '../NotificationCenter'
import { ThemeToggle } from '../ThemeToggle'
import { HeaderLogoutButton } from '../HeaderLogoutButton'
import { UserAvatar } from './UserAvatar'
import { UserMenuPopover } from './UserMenuPopover'
import { TECHNICAL_NAV_CATEGORIES, type TechnicalNavCategoryId } from './technicalNavConfig'

interface TechnicalStaffShellProps {
  user: any
  onNavigateToPath: (path: string) => void
  onLogout: () => void
  mainContentRef?: RefObject<HTMLElement | null>
  children: ReactNode
}

function getTechnicalCategoryForPath(pathname: string): TechnicalNavCategoryId {
  for (const cat of TECHNICAL_NAV_CATEGORIES) {
    if (cat.children.some((child) => pathname === child.path || pathname.startsWith(child.path))) {
      return cat.id
    }
  }
  return 'general'
}

export function TechnicalStaffShell({
  user,
  onNavigateToPath,
  onLogout,
  mainContentRef,
  children,
}: TechnicalStaffShellProps) {
  const location = useLocation()
  const [selectedCategory, setSelectedCategory] = useState<TechnicalNavCategoryId>(() =>
    getTechnicalCategoryForPath(location.pathname)
  )
  const [hoveredCategory, setHoveredCategory] = useState<TechnicalNavCategoryId | null>(null)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('technical_nav_sidebar_collapsed') === 'true'
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
          localStorage.setItem('technical_nav_sidebar_collapsed', 'true')
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
    const cat = getTechnicalCategoryForPath(location.pathname)
    setSelectedCategory(cat)
    setHoveredCategory(null)
  }, [location.pathname])

  const handleCategoryMouseEnter = (catId: TechnicalNavCategoryId) => {
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

  const handleCategoryClick = (catId: TechnicalNavCategoryId) => {
    setSelectedCategory(catId)
    setHoveredCategory(null)
    if (isCollapsed) {
      setIsCollapsed(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem('technical_nav_sidebar_collapsed', 'false')
      }
    }
    const catObj = TECHNICAL_NAV_CATEGORIES.find((c) => c.id === catId)
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
  const currentCategoryObj = TECHNICAL_NAV_CATEGORIES.find((cat) => cat.id === activeCategory)
  const currentChildObj = currentCategoryObj?.children.find((child) =>
    location.pathname === child.path || location.pathname.startsWith(child.path)
  )

  const isEffectiveCollapsed = isCollapsed && !isHoverExpanded
  const isHoverOverlay = isCollapsed && isHoverExpanded
  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Teknik Personel'

  const renderIcon = (iconName: string) => {
    switch (iconName) {
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
    <div
      className={`management-shell-layout technical-shell-layout ${
        isCollapsed ? 'secondary-collapsed' : ''
      } ${isHoverOverlay ? 'hover-overlay-active' : ''}`}
    >
      <a className="skip-link" href="#technical-main-content">Ana içeriğe geç</a>
      {/* Primary 64px Icon Rail + Secondary 230px Sidebar Area */}
      <div
        ref={sidebarAreaRef}
        className="shell-sidebar-area"
        onMouseEnter={handleSidebarAreaMouseEnter}
        onMouseLeave={handleSidebarAreaMouseLeave}
      >
        {/* Rail */}
        <aside className="nav-rail" aria-label="Teknik Personel Portalı Menüsü">
          <button
            type="button"
            className="nav-rail-brand"
            onClick={() => onNavigateToPath('/technical/requests')}
            title="Teknik Personel Portalı"
          >
            <span className="brand-mark">TP</span>
          </button>

          <nav className="nav-rail-categories">
            {TECHNICAL_NAV_CATEGORIES.map((cat) => {
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
                      localStorage.setItem('technical_nav_sidebar_collapsed', String(next))
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
                const isActive = location.pathname === child.path || location.pathname.startsWith(child.path)
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
              <span className="breadcrumb-parent">Teknik Personel Portalı</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{currentChildObj?.label || 'Atanan Talepler'}</span>
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

        <main id="technical-main-content" ref={mainContentRef} tabIndex={-1} className="shell-content">
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
        userRoles={user?.roles || ['TECHNICAL_STAFF']}
        onNavigateToView={(viewId) => {
          if (viewId === 'account') onNavigateToPath('/account')
          else if (viewId === 'settings') onNavigateToPath('/settings')
          else onNavigateToPath('/technical/requests')
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
