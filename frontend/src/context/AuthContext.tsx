import React, { createContext, useContext, useEffect, useState } from 'react'
import { loginApi, setUnauthorizedHandler } from '../api'
import type { AuthenticatedUser, LoginRequest } from '../types'

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  RESIDENT: 'RESIDENT',
  TECHNICAL_STAFF: 'TECHNICAL_STAFF',
} as const

interface AuthContextType {
  accessToken: string | null
  user: AuthenticatedUser | null
  isAuthenticated: boolean
  loading: boolean
  sessionExpiredMessage: string | null
  login: (credentials: LoginRequest) => Promise<void>
  logout: (reason?: string) => void
  updateCurrentUserFullName: (fullName: string) => void
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  clearSessionMessage: () => void
}

const STORAGE_KEYS = {
  TOKEN: 'rms_access_token',
  EXPIRES_AT: 'rms_expires_at_utc',
  USER: 'rms_user',
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null)

  const logout = (reason?: string) => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT)
    localStorage.removeItem(STORAGE_KEYS.USER)
    setAccessToken(null)
    setUser(null)
    if (reason) {
      setSessionExpiredMessage(reason)
    }
  }

  const clearSessionMessage = () => {
    setSessionExpiredMessage(null)
  }

  const updateCurrentUserFullName = (fullName: string) => {
    const normalizedFullName = fullName.trim().replace(/\s+/g, ' ')
    const separatorIndex = normalizedFullName.lastIndexOf(' ')
    if (separatorIndex <= 0) return

    setUser((currentUser) => {
      if (!currentUser) return currentUser
      const updatedUser = {
        ...currentUser,
        firstName: normalizedFullName.slice(0, separatorIndex),
        lastName: normalizedFullName.slice(separatorIndex + 1),
      }
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser))
      return updatedUser
    })
  }

  useEffect(() => {
    const initAuth = () => {
      try {
        const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN)
        const storedExpiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT)
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER)

        if (storedToken && storedExpiresAt && storedUser) {
          const expiresDate = new Date(storedExpiresAt)
          if (expiresDate > new Date()) {
            setAccessToken(storedToken)
            setUser(JSON.parse(storedUser))
          } else {
            logout()
          }
        }
      } catch {
        logout()
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    setUnauthorizedHandler(() => {
      logout('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.')
    })
  }, [])

  const login = async (credentials: LoginRequest) => {
    setSessionExpiredMessage(null)
    const response = await loginApi(credentials)
    setAccessToken(response.accessToken)
    setUser(response.user)

    localStorage.setItem(STORAGE_KEYS.TOKEN, response.accessToken)
    localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, response.expiresAtUtc)
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user))
  }

  const hasRole = (role: string): boolean => {
    if (!user || !user.roles) return false
    return user.roles.includes(role)
  }

  const hasAnyRole = (roles: string[]): boolean => {
    if (!user || !user.roles) return false
    return roles.some((r) => user.roles.includes(r))
  }

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        user,
        isAuthenticated: Boolean(accessToken && user),
        loading,
        sessionExpiredMessage,
        login,
        logout,
        updateCurrentUserFullName,
        hasRole,
        hasAnyRole,
        clearSessionMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
