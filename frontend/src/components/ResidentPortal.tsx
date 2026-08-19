import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { getMyUnits } from '../api'
import { useAuth } from '../context/AuthContext'
import { useRouteChangeGuard } from '../hooks/useRouteChangeGuard'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import type { ResidentUnit } from '../types'
import { groupResidentUnits } from '../utils/residentUnits'
import { Account } from './Account'
import { ConfirmationDialog } from './ConfirmationDialog'
import { HeaderAccountButton } from './HeaderAccountButton'
import { HeaderLogoutButton } from './HeaderLogoutButton'
import { HeaderSettingsButton } from './HeaderSettingsButton'
import { NotificationCenter } from './NotificationCenter'
import { ResidentAnnouncements } from './ResidentAnnouncements'
import { ResidentFinance } from './ResidentFinance'
import { ResidentHome } from './ResidentHome'
import { ResidentMaintenanceRequests } from './ResidentMaintenanceRequests'
import { ResidentUnitDetail } from './ResidentUnitDetail'
import { ResidentUnits } from './ResidentUnits'
import { Settings } from './Settings'
import { ThemeToggle } from './ThemeToggle'

const RESIDENT_NAVIGATION = [
  { path: '/resident/home', label: 'Ana Sayfa' },
  { path: '/resident/my-units', label: 'Dairelerim' },
  { path: '/resident/finance', label: 'Finans' },
  { path: '/resident/announcements', label: 'Duyurular' },
  { path: '/resident/requests', label: 'Taleplerim' },
]

export function ResidentPortal() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [units, setUnits] = useState<ResidentUnit[]>([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(true)
  const [unitsError, setUnitsError] = useState('')
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const mainContentRef = useRef<HTMLElement>(null)
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(settingsDirty)
  const clearRouteState = useCallback(() => setSettingsDirty(false), [])
  const { navigateWithGuard } = useRouteChangeGuard({
    isDirty: settingsDirty,
    requestDiscard,
    onApprovedRouteChange: clearRouteState,
  })

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
      : location.pathname === path || (path === '/resident/requests' && location.pathname === '/resident/maintenance-requests')
  )

  const isMyUnits = location.pathname === '/resident/my-units'
  const isFinance = location.pathname === '/resident/finance'
  const isAnnouncements = location.pathname === '/resident/announcements'
  const isRequests = location.pathname === '/resident/requests' || location.pathname === '/resident/maintenance-requests'
  const isAccount = location.pathname === '/account' || location.pathname === '/resident/account'
  const isSettings = location.pathname === '/settings'

  return (
    <div className="resident-portal">
      <a className="skip-link" href="#resident-main-content">Ana içeriğe geç</a>
      <header className="resident-navigation">
        <button className="resident-brand" type="button" onClick={() => { void navigateWithGuard('/resident/home') }}>
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
              onClick={() => { void navigateWithGuard(item.path) }}
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
          <NotificationCenter onNavigateToUrl={(url) => { void navigateWithGuard(url) }} />
          <ThemeToggle />
          <HeaderAccountButton onActivate={() => { void navigateWithGuard('/account') }} />
          <HeaderSettingsButton onActivate={() => { void navigateWithGuard('/settings') }} />
          <HeaderLogoutButton onActivate={() => setIsLogoutDialogOpen(true)} />
        </div>
      </header>

      <main
        id="resident-main-content"
        ref={mainContentRef}
        tabIndex={-1}
        className="resident-portal-main"
        aria-busy={!['/account', '/resident/account', '/settings'].includes(location.pathname) && isLoadingUnits}
      >
        {isMyUnits ? (
          <ResidentUnits
            units={units}
            isLoading={isLoadingUnits}
            error={unitsError}
            onRetry={() => void loadUnits()}
            onOpenDetail={(unitId) => navigate(`/resident/my-units/${unitId}`)}
          />
        ) : isFinance ? (
          <ResidentFinance />
        ) : isAnnouncements ? (
          <ResidentAnnouncements />
        ) : isRequests ? (
          <ResidentMaintenanceRequests />
        ) : detailMatch ? (
          <ResidentUnitDetail
            unit={detailUnit}
            isLoading={isLoadingUnits}
            error={unitsError}
            onRetry={() => void loadUnits()}
            onBack={() => navigate('/resident/my-units')}
          />
        ) : isAccount ? (
          <Account onOpenSettings={() => { void navigateWithGuard('/settings') }} />
        ) : isSettings ? (
          <section className="resident-view-content">
            <header className="resident-view-header">
              <p className="eyebrow">Sakin Portalı</p>
              <h1>Ayarlar</h1>
              <p>Görünüm ve hesap tercihlerinizi yönetin.</p>
            </header>
            <Settings onDirtyChange={setSettingsDirty} requestDiscard={requestDiscard} />
          </section>
        ) : (
          <ResidentHome
            firstName={user?.firstName || 'Merhaba'}
            units={units}
            isLoading={isLoadingUnits}
            error={unitsError}
            onRetry={() => void loadUnits()}
            onNavigate={navigate}
          />
        )}
      </main>

      {isLogoutDialogOpen && (
        <ConfirmationDialog
          title="Çıkış Yap"
          message={settingsDirty
            ? 'Kaydedilmemiş değişiklikleriniz var. Çıkış yaparsanız bu değişiklikler kaybolacak.'
            : 'Çıkış yapmak istediğinizden emin misiniz?'}
          confirmLabel="Çıkış Yap"
          danger
          onCancel={() => setIsLogoutDialogOpen(false)}
          onConfirm={() => {
            setIsLogoutDialogOpen(false)
            setSettingsDirty(false)
            logout()
            navigate('/login', { replace: true })
          }}
        />
      )}
      {unsavedChangesDialog}
    </div>
  )
}
