import { describe, expect, it } from 'vitest'
import { getProtectedRouteRedirect } from '../routeAccess'

describe('protected route decisions', () => {
  it.each([
    ['/properties', ['ADMIN'], null],
    ['/properties', ['MANAGER'], null],
    ['/users', ['MANAGER'], '/dashboard'],
    ['/resident/my-units/12', ['RESIDENT'], null],
    ['/properties', ['RESIDENT'], '/resident/home'],
    ['/technical/requests/3', ['TECHNICAL_STAFF'], null],
    ['/resident/home', ['TECHNICAL_STAFF'], '/technical/requests'],
    ['/properties', ['TECHNICAL_STAFF'], '/technical/requests'],
  ])('%s with %j resolves to %s', (pathname, roles, expected) => {
    expect(getProtectedRouteRedirect(pathname as string, roles as string[], true)).toBe(expected)
  })

  it('redirects unauthenticated users to login', () => {
    expect(getProtectedRouteRedirect('/dashboard', [], false)).toBe('/login')
    expect(getProtectedRouteRedirect('/login', [], false)).toBeNull()
  })
})
