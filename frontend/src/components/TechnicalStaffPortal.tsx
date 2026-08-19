import { useCallback, useEffect, useRef, useState } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRouteChangeGuard } from '../hooks/useRouteChangeGuard'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { Account } from './Account'
import { ConfirmationDialog } from './ConfirmationDialog'
import { HeaderAccountButton } from './HeaderAccountButton'
import { HeaderLogoutButton } from './HeaderLogoutButton'
import { HeaderSettingsButton } from './HeaderSettingsButton'
import { NotificationCenter } from './NotificationCenter'
import { Settings } from './Settings'
import { TechnicalMaintenanceRequestDetail } from './TechnicalMaintenanceRequestDetail'
import { TechnicalMaintenanceRequests } from './TechnicalMaintenanceRequests'
import { ThemeToggle } from './ThemeToggle'

const TECHNICAL_NAVIGATION = [
  { path: '/technical/requests', label: 'Atanan Talepler' },
]

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

  const isNavigationActive = (path: string) => location.pathname === path || location.pathname.startsWith(path)

  const detailMatch = matchPath('/technical/requests/:id', location.pathname)
  const detailRequestId = detailMatch?.params.id ? Number(detailMatch.params.id) : null

  const isAccountView = location.pathname === '/account' || location.pathname === '/technical/account'
  const isSettingsView = location.pathname === '/settings'

  return (
    <div className="resident-portal technical-portal">
      <a className="skip-link" href="#technical-main-content">Ana içeriğe geç</a>
      <header className="resident-navigation">
        <button className="resident-brand" type="button" onClick={() => { void navigateWithGuard('/technical/requests') }}>
          <span aria-hidden="true">TP</span>
          <span><strong>Site Yönetimi</strong><small>Teknik Personel Portalı</small></span>
        </button>

        <nav className="resident-nav-links" aria-label="Teknik personel portalı menüsü">
          {TECHNICAL_NAVIGATION.map((item) => (
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
            <span>Teknik Personel</span>
          </div>
          <NotificationCenter onNavigateToUrl={(url) => { void navigateWithGuard(url) }} />
          <ThemeToggle />
          <HeaderAccountButton onActivate={() => { void navigateWithGuard('/account') }} />
          <HeaderSettingsButton onActivate={() => { void navigateWithGuard('/settings') }} />
          <HeaderLogoutButton onActivate={() => setIsLogoutDialogOpen(true)} />
        </div>
      </header>

      <main
        id="technical-main-content"
        ref={mainContentRef}
        tabIndex={-1}
        className="resident-portal-main"
      >
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
