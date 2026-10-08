const MANAGEMENT_ROUTES = new Set([
  '/dashboard', '/properties', '/buildings', '/units', '/management/floor-map',
  '/manager/my-scope', '/users', '/residents', '/manager-assignments',
  '/management/finance', '/management/finance/due-definitions',
  '/management/finance/due-periods', '/management/finance/expenses',
  '/management/finance/payment-submissions', '/management/import',
  '/management/facilities', '/management/visitors', '/management/vehicles',
  '/management/documents', '/management/analytics', '/management/announcements',
  '/management/maintenance-requests', '/account', '/settings',
])

const RESIDENT_ROUTES = new Set([
  '/resident/home', '/resident/my-units', '/resident/finance', '/resident/facilities',
  '/resident/visitors', '/resident/vehicles', '/resident/documents',
  '/resident/announcements', '/resident/requests', '/resident/maintenance-requests',
  '/resident/account', '/account', '/settings',
])

function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role)
}

function isManagementRoute(pathname: string): boolean {
  return MANAGEMENT_ROUTES.has(pathname) || /^\/units\/[^/]+$/.test(pathname)
}

function isResidentRoute(pathname: string): boolean {
  return RESIDENT_ROUTES.has(pathname) ||
    /^\/resident\/my-units\/[^/]+$/.test(pathname) ||
    pathname.startsWith('/resident/facilities') ||
    pathname.startsWith('/resident/visitors') ||
    pathname.startsWith('/resident/vehicles') ||
    pathname.startsWith('/resident/documents')
}

function isTechnicalRoute(pathname: string): boolean {
  return pathname === '/technical/requests' ||
    pathname.startsWith('/technical/requests/') ||
    pathname === '/technical/maintenance-requests' ||
    pathname === '/technical/account' ||
    pathname === '/account' ||
    pathname === '/settings'
}

export function getProtectedRouteRedirect(
  pathname: string,
  roles: string[],
  isAuthenticated: boolean,
): string | null {
  if (!isAuthenticated) return pathname === '/login' ? null : '/login'

  const isManagement = hasRole(roles, 'ADMIN') || hasRole(roles, 'MANAGER')
  if (isManagement) {
    if (pathname === '/users' && !hasRole(roles, 'ADMIN')) return '/dashboard'
    if (pathname === '/manager-assignments' && !hasRole(roles, 'ADMIN')) return '/dashboard'
    if (pathname === '/management/import' && !hasRole(roles, 'ADMIN')) return '/dashboard'
    if (pathname === '/manager/my-scope' && (!hasRole(roles, 'MANAGER') || hasRole(roles, 'ADMIN'))) {
      return '/dashboard'
    }
    return isManagementRoute(pathname) ? null : '/dashboard'
  }

  const isResident = hasRole(roles, 'RESIDENT') && !hasRole(roles, 'TECHNICAL_STAFF')
  if (isResident) return isResidentRoute(pathname) ? null : '/resident/home'

  if (hasRole(roles, 'TECHNICAL_STAFF')) {
    return isTechnicalRoute(pathname) ? null : '/technical/requests'
  }

  return pathname === '/' || pathname === '/account' || pathname === '/settings' ? null : '/'
}
