import { useCallback, useEffect, useMemo, useState } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRouteChangeGuard } from '../hooks/useRouteChangeGuard'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import type { ResidentUnit } from '../types'
import { getMyUnits } from '../api'
import { groupResidentUnits } from '../utils/residentUnits'
import { Account } from './Account'
import { ConfirmationDialog } from './ConfirmationDialog'
import { ResidentAnnouncements } from './ResidentAnnouncements'
import { ResidentFacilities } from './ResidentFacilities'
import { ResidentFinance } from './ResidentFinance'
import { ResidentHome } from './ResidentHome'
import { ResidentMaintenanceRequests } from './ResidentMaintenanceRequests'
import { ResidentUnitDetail } from './ResidentUnitDetail'
import { ResidentUnits } from './ResidentUnits'
import { ResidentVehicles } from './ResidentVehicles'
import { ResidentVisitors } from './ResidentVisitors'
import { Settings } from './Settings'
import { ResidentShell } from './nav/ResidentShell'

export function ResidentPortal() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [units, setUnits] = useState<ResidentUnit[]>([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(true)
  const [unitsError, setUnitsError] = useState<string | null>(null)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [settingsDirty, setSettingsDirty] = useState(false)

  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(settingsDirty)
  const clearRouteState = useCallback(() => setSettingsDirty(false), [])
  const { navigateWithGuard } = useRouteChangeGuard({
    isDirty: settingsDirty,
    requestDiscard,
    onApprovedRouteChange: clearRouteState,
  })

  const loadUnits = useCallback(async () => {
    try {
      setIsLoadingUnits(true)
      setUnitsError(null)
      const data = await getMyUnits()
      setUnits(data)
    } catch (err) {
      setUnitsError(err instanceof Error ? err.message : 'Daire bilgileri yüklenemedi.')
    } finally {
      setIsLoadingUnits(false)
    }
  }, [])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  const detailMatch = matchPath('/resident/my-units/:id', location.pathname)
  const groupedUnits = useMemo(() => groupResidentUnits(units), [units])
  const detailUnitId = detailMatch?.params.id ? Number(detailMatch.params.id) : null
  const detailUnit = detailUnitId ? (groupedUnits.find((u) => u.unitId === detailUnitId) ?? null) : null

  const isMyUnits = location.pathname === '/resident/my-units'
  const isFinance = location.pathname === '/resident/finance'
  const isFacilities = location.pathname === '/resident/facilities'
  const isVisitors = location.pathname === '/resident/visitors'
  const isVehicles = location.pathname === '/resident/vehicles'
  const isAnnouncements = location.pathname === '/resident/announcements'
  const isRequests = location.pathname === '/resident/requests' || location.pathname === '/resident/maintenance-requests'
  const isAccount = location.pathname === '/account' || location.pathname === '/resident/account'
  const isSettings = location.pathname === '/settings'

  return (
    <ResidentShell
      user={user}
      onNavigateToPath={(path) => { void navigateWithGuard(path) }}
      onLogout={() => setIsLogoutDialogOpen(true)}
    >
      <div className="resident-portal-body">
        {isMyUnits ? (
          <ResidentUnits
            units={units}
            isLoading={isLoadingUnits}
            error={unitsError || ''}
            onRetry={() => void loadUnits()}
            onOpenDetail={(unitId) => navigate(`/resident/my-units/${unitId}`)}
          />
        ) : isFinance ? (
          <ResidentFinance />
        ) : isFacilities ? (
          <ResidentFacilities />
        ) : isVisitors ? (
          <ResidentVisitors />
        ) : isVehicles ? (
          <ResidentVehicles />
        ) : isAnnouncements ? (
          <ResidentAnnouncements />
        ) : isRequests ? (
          <ResidentMaintenanceRequests />
        ) : detailMatch ? (
          <ResidentUnitDetail
            unit={detailUnit}
            isLoading={isLoadingUnits}
            error={unitsError || ''}
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
            error={unitsError || ''}
            onRetry={() => void loadUnits()}
            onNavigate={(path) => void navigateWithGuard(path)}
          />
        )}
      </div>

      {isLogoutDialogOpen && (
        <ConfirmationDialog
          title="Oturumu Kapat"
          message="Sakin portalından çıkış yapmak istediğinize emin misiniz?"
          confirmLabel="Çıkış Yap"
          cancelLabel="Vazgeç"
          danger
          onConfirm={() => {
            setIsLogoutDialogOpen(false)
            setSettingsDirty(false)
            logout()
            navigate('/login', { replace: true })
          }}
          onCancel={() => setIsLogoutDialogOpen(false)}
        />
      )}
      {unsavedChangesDialog}
    </ResidentShell>
  )
}
