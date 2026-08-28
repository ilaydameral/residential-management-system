import { useCallback, useEffect, useRef, useState } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRouteChangeGuard } from '../hooks/useRouteChangeGuard'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { Account } from './Account'
import { ConfirmationDialog } from './ConfirmationDialog'
import { Settings } from './Settings'
import { TechnicalMaintenanceRequestDetail } from './TechnicalMaintenanceRequestDetail'
import { TechnicalMaintenanceRequests } from './TechnicalMaintenanceRequests'
import { TechnicalStaffShell } from './nav/TechnicalStaffShell'

export function TechnicalStaffPortal() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
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

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (document.querySelector('.confirmation-overlay, .management-drawer')) return
      mainContentRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [location.pathname])

  const detailMatch = matchPath('/technical/requests/:id', location.pathname)
  const detailRequestId = detailMatch?.params.id ? Number(detailMatch.params.id) : null

  const isAccountView = location.pathname === '/account' || location.pathname === '/technical/account'
  const isSettingsView = location.pathname === '/settings'

  return (
    <TechnicalStaffShell
      user={user}
      onNavigateToPath={(path) => { void navigateWithGuard(path) }}
      onLogout={() => setIsLogoutDialogOpen(true)}
      mainContentRef={mainContentRef}
    >
      <div className="technical-portal-body">
        {detailRequestId && !isNaN(detailRequestId) ? (
          <TechnicalMaintenanceRequestDetail
            requestId={detailRequestId}
            onBack={() => { void navigateWithGuard('/technical/requests') }}
          />
        ) : isAccountView ? (
          <Account onOpenSettings={() => { void navigateWithGuard('/settings') }} />
        ) : isSettingsView ? (
          <section className="resident-view-content">
            <header className="resident-view-header">
              <p className="eyebrow">TEKNİK PERSONEL PORTALI</p>
              <h1>Ayarlar</h1>
              <p>Görünüm ve hesap tercihlerinizi yönetin.</p>
            </header>
            <Settings onDirtyChange={setSettingsDirty} requestDiscard={requestDiscard} />
          </section>
        ) : (
          <TechnicalMaintenanceRequests />
        )}
      </div>

      {isLogoutDialogOpen && (
        <ConfirmationDialog
          title="Oturumu Kapat"
          message="Teknik personel portalından çıkış yapmak istediğinize emin misiniz?"
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
    </TechnicalStaffShell>
  )
}
