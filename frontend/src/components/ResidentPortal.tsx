import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { getMyUnits } from '../api'
import { useAuth } from '../context/AuthContext'
import type { ResidentUnit } from '../types'
import { groupResidentUnits } from '../utils/residentUnits'
import { ConfirmationDialog } from './ConfirmationDialog'
import { ResidentAccount } from './ResidentAccount'
import { ResidentHome } from './ResidentHome'
import { ResidentUnitDetail } from './ResidentUnitDetail'
import { ResidentUnits } from './ResidentUnits'
import { ThemeToggle } from './ThemeToggle'

const RESIDENT_NAVIGATION = [
  { path: '/resident/home', label: 'Ana Sayfa' },
  { path: '/resident/my-units', label: 'Dairelerim' },
  { path: '/resident/account', label: 'Hesabım' },
]

export function ResidentPortal() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [units, setUnits] = useState<ResidentUnit[]>([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(true)
  const [unitsError, setUnitsError] = useState('')
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const mainContentRef = useRef<HTMLElement>(null)

  const loadUnits = useCallback(async () => {
    setIsLoadingUnits(true)
    setUnitsError('')
    try {
      setUnits(await getMyUnits())
    } catch (loadError) {
      setUnits([])
      setUnitsError(loadError instanceof Error ? loadError.message : 'Daire bilgileriniz yüklenemedi.')
    } finally {
      setIsLoadingUnits(false)
    }
  }, [])

  useEffect(() => { void loadUnits() }, [loadUnits])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (document.querySelector('.confirmation-overlay, .management-drawer')) return
      mainContentRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [location.pathname])

  const detailMatch = matchPath('/resident/my-units/:unitId', location.pathname)
  const groupedUnits = useMemo(() => groupResidentUnits(units), [units])
  const detailUnitId = detailMatch?.params.unitId ? Number(detailMatch.params.unitId) : null
  const detailUnit = detailUnitId == null
    ? null
    : groupedUnits.find((unit) => unit.unitId === detailUnitId) ?? null

  const isNavigationActive = (path: string) => (
    path === '/resident/my-units'
      ? location.pathname.startsWith('/resident/my-units')
      : location.pathname === path
  )

  return (
    <div className="resident-portal">
      <a className="skip-link" href="#resident-main-content">Ana içeriğe geç</a>
      <header className="resident-navigation">
        <button className="resident-brand" type="button" onClick={() => navigate('/resident/home')}>
          <span aria-hidden="true">SY</span>
          <span><strong>Site Yönetimi</strong><small>Sakin Portalı</small></span>
        </button>

        <nav className="resident-nav-links" aria-label="Sakin portalı menüsü">
          {RESIDENT_NAVIGATION.map((item) => (
            <button
              className={isNavigationActive(item.path) ? 'active' : ''}
              type="button"
              key={item.path}
              aria-current={isNavigationActive(item.path) ? 'page' : undefined}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="resident-user-actions">
          <div className="resident-user-summary">
            <strong>{user?.firstName} {user?.lastName}</strong>
            <span>Sakin</span>
          </div>
          <ThemeToggle />
          <button className="secondary-button" type="button" onClick={() => setIsLogoutDialogOpen(true)}>
            Çıkış Yap
          </button>
        </div>
      </header>

      <main id="resident-main-content" ref={mainContentRef} tabIndex={-1} className="resident-portal-main" aria-busy={isLoadingUnits}>
        {location.pathname === '/resident/home' && (
          <ResidentHome
            firstName={user?.firstName || 'Merhaba'}
            units={units}
            isLoading={isLoadingUnits}
            error={unitsError}
            onRetry={() => void loadUnits()}
            onNavigate={navigate}
          />
        )}
        {location.pathname === '/resident/my-units' && (
          <ResidentUnits
            units={units}
            isLoading={isLoadingUnits}
            error={unitsError}
            onRetry={() => void loadUnits()}
            onOpenDetail={(unitId) => navigate(`/resident/my-units/${unitId}`)}
          />
        )}
        {detailMatch && (
          <ResidentUnitDetail
            unit={detailUnit}
            isLoading={isLoadingUnits}
            error={unitsError}
            onRetry={() => void loadUnits()}
            onBack={() => navigate('/resident/my-units')}
          />
        )}
        {location.pathname === '/resident/account' && <ResidentAccount />}
      </main>

      {isLogoutDialogOpen && (
        <ConfirmationDialog
          title="Çıkış Yap"
          message="Çıkış yapmak istediğinizden emin misiniz?"
          confirmLabel="Çıkış Yap"
          danger
          onCancel={() => setIsLogoutDialogOpen(false)}
          onConfirm={() => {
            setIsLogoutDialogOpen(false)
            logout()
            navigate('/login', { replace: true })
          }}
        />
      )}
    </div>
  )
}
