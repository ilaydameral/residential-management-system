import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createManagedUser,
  getManagedUserDetail,
  getRoles,
  getUsers,
  setManagedUserActive,
  updateManagedUser,
  updateManagedUserRoles,
} from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import type { ManagedUser, Role } from '../types'
import { RowActionsMenu } from './RowActionsMenu'
import { LoadingSkeleton } from './LoadingSkeleton'
import { ConfirmationDialog } from './ConfirmationDialog'
import { SaveShortcutHint } from './SaveShortcutHint'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'

interface CentralUserManagementProps {
  onDirtyChange: (isDirty: boolean) => void
  onViewUnits: (email: string) => void
}

type DrawerMode = 'none' | 'create' | 'edit' | 'roles'

interface UserConfirmation {
  title: string
  message: string
  confirmLabel: string
  danger: boolean
  action: () => Promise<void>
}

interface UserFormState {
  firstName: string
  lastName: string
  email: string
  password: string
  roleCodes: string[]
  isActive: boolean
}

const initialForm: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  roleCodes: [],
  isActive: true,
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Yönetici',
  MANAGER: 'Site Yöneticisi',
  RESIDENT: 'Sakin',
  TECHNICAL_STAFF: 'Teknik Personel',
}

function getRoleLabel(code: string): string {
  return ROLE_LABELS[code] || 'Tanımlı Rol'
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function normalizeForm(form: UserFormState): UserFormState {
  return { ...form, roleCodes: [...form.roleCodes].sort() }
}

export function CentralUserManagement({ onDirtyChange, onViewUnits }: CentralUserManagementProps) {
  const { hasRole, user: currentUser } = useAuth()
  const { showToast } = useToast()
  const isAdmin = hasRole('ADMIN')
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [confirmation, setConfirmation] = useState<UserConfirmation | null>(null)
  const [isConfirmationRunning, setIsConfirmationRunning] = useState(false)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [drawerMode, setDrawerMode] = useState<DrawerMode>('none')
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null)
  const [form, setForm] = useState<UserFormState>(initialForm)
  const [formBaseline, setFormBaseline] = useState<UserFormState>(initialForm)

  const isDirty = drawerMode !== 'none' &&
    JSON.stringify(normalizeForm(form)) !== JSON.stringify(normalizeForm(formBaseline))
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isDirty)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      if (isAdmin) {
        const [userData, roleData] = await Promise.all([getUsers(), getRoles()])
        setUsers(userData)
        setRoles(roleData.filter((role) => role.isActive))
      } else {
        setUsers(await getUsers())
        setRoles([])
      }
    } catch (error) {
      setUsers([])
      setLoadError(getErrorMessage(error, 'Kullanıcılar yüklenemedi.'))
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const availableRoleCodes = useMemo(() => {
    if (roles.length > 0) return roles.map((role) => role.code)
    return Array.from(new Set(users.flatMap((user) => user.roles))).sort()
  }, [roles, users])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR')
    return users.filter((user) => {
      const matchesSearch = !query ||
        user.fullName.toLocaleLowerCase('tr-TR').includes(query) ||
        user.email.toLocaleLowerCase('tr-TR').includes(query)
      const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter)
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' ? user.isActive : !user.isActive)
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [roleFilter, search, statusFilter, users])

  const closeDrawerState = () => {
    setDrawerMode('none')
    setSelectedUser(null)
    setForm(initialForm)
    setFormBaseline(initialForm)
    setActionError('')
  }

  const closeDrawer = async () => {
    if (!(await requestDiscard())) return
    drawerAnimation.close(closeDrawerState)
  }

  const drawerAnimation = useAnimatedDrawer(drawerMode !== 'none')
  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.shouldRender && !drawerAnimation.isClosing,
    onClose: () => { void closeDrawer() },
    isSaving: isSubmitting || isDetailLoading || confirmation !== null,
  })

  const openCreate = async () => {
    if (!(await requestDiscard())) return
    const defaultRole = roles.find((role) => role.code === 'RESIDENT') ?? roles[0]
    const nextForm = { ...initialForm, roleCodes: defaultRole ? [defaultRole.code] : [] }
    setActionError('')
    setSelectedUser(null)
    setForm(nextForm)
    setFormBaseline(nextForm)
    setDrawerMode('create')
  }

  const openEdit = async (managedUser: ManagedUser) => {
    if (!(await requestDiscard())) return
    setActionError('')
    setSelectedUser(managedUser)
    setForm(initialForm)
    setFormBaseline(initialForm)
    setDrawerMode('edit')
    setIsDetailLoading(true)
    try {
      const detail = await getManagedUserDetail(managedUser.id)
      const editForm: UserFormState = {
        firstName: detail.firstName,
        lastName: detail.lastName,
        email: detail.email,
        password: '',
        roleCodes: detail.roles,
        isActive: detail.isActive,
      }
      setForm(editForm)
      setFormBaseline(editForm)
    } catch (error) {
      drawerAnimation.close(() => {
        setDrawerMode('none')
        setSelectedUser(null)
        setActionError(getErrorMessage(error, 'Kullanıcı bilgileri yüklenemedi.'))
      })
    } finally {
      setIsDetailLoading(false)
    }
  }

  const openRoles = async (managedUser: ManagedUser) => {
    if (!(await requestDiscard())) return
    const roleForm = { ...initialForm, roleCodes: [...managedUser.roles] }
    setActionError('')
    setSelectedUser(managedUser)
    setForm(roleForm)
    setFormBaseline(roleForm)
    setDrawerMode('roles')
  }

  const toggleRole = (code: string) => {
    setForm((current) => ({
      ...current,
      roleCodes: current.roleCodes.includes(code)
        ? current.roleCodes.filter((roleCode) => roleCode !== code)
        : [...current.roleCodes, code],
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionError('')
    if (form.roleCodes.length === 0 && drawerMode !== 'edit') {
      setActionError('En az bir rol seçmelisiniz.')
      return
    }
    if (drawerMode === 'roles' && selectedUser) {
      if (confirmation) return
      setConfirmation({
        title: 'Kullanıcı Rollerini Değiştir',
        message: `${selectedUser.fullName} kullanıcısının rollerini değiştirmek istediğinizden emin misiniz?`,
        confirmLabel: 'Rolleri Güncelle',
        danger: selectedUser.roles.includes('ADMIN') && !form.roleCodes.includes('ADMIN'),
        action: async () => {
          try {
            await updateManagedUserRoles(selectedUser.id, { roleCodes: form.roleCodes })
            drawerAnimation.close(closeDrawerState)
            await loadData()
            showToast('Kullanıcı rolleri güncellendi.')
          } catch (error) {
            setActionError(getErrorMessage(error, 'Kullanıcı rolleri güncellenemedi.'))
          }
        },
      })
      return
    }

    setIsSubmitting(true)
    const completedMode = drawerMode
    try {
      if (drawerMode === 'create') {
        await createManagedUser({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          roleCodes: form.roleCodes,
          isActive: form.isActive,
        })
      } else if (drawerMode === 'edit' && selectedUser) {
        await updateManagedUser(selectedUser.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
        })
      }
      drawerAnimation.close(closeDrawerState)
      await loadData()
      showToast(
        completedMode === 'create'
          ? 'Kullanıcı oluşturuldu.'
          : 'Kullanıcı bilgileri güncellendi.'
      )
    } catch (error) {
      setActionError(getErrorMessage(error, 'Kullanıcı işlemi tamamlanamadı.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (managedUser: ManagedUser) => {
    setActionError('')
    const nextActive = !managedUser.isActive
    const action = nextActive ? 'aktif' : 'pasif'
    if (confirmation) return
    setConfirmation({
      title: nextActive ? 'Kullanıcıyı Aktifleştir' : 'Kullanıcıyı Pasifleştir',
      message: `${managedUser.fullName} hesabını ${nextActive ? 'aktifleştirmek' : 'pasifleştirmek'} istediğinizden emin misiniz?`,
      confirmLabel: nextActive ? 'Aktifleştir' : 'Pasifleştir',
      danger: !nextActive,
      action: async () => {
        try {
          await setManagedUserActive(managedUser.id, nextActive)
          await loadData()
          showToast(nextActive ? 'Kullanıcı aktif hâle getirildi.' : 'Kullanıcı pasif hâle getirildi.')
        } catch (error) {
          setActionError(getErrorMessage(error, `Kullanıcı ${action} duruma getirilemedi.`))
        }
      },
    })
  }

  const confirmUserAction = async () => {
    if (!confirmation || isConfirmationRunning) return
    setIsConfirmationRunning(true)
    try {
      await confirmation.action()
    } finally {
      setIsConfirmationRunning(false)
      setConfirmation(null)
    }
  }

  const activeFilterCount = [
    search.trim() !== '',
    roleFilter !== 'all',
    statusFilter !== 'all',
  ].filter(Boolean).length

  return (
    <section className="central-user-view entity-management-view" aria-busy={isLoading || isDetailLoading}>
      <div className="entity-page-actions">
        <p>{!isLoading && !loadError ? `${filteredUsers.length} kullanıcı gösteriliyor.` : 'Sistem kullanıcılarını merkezi olarak görüntüleyin.'}</p>
        {isAdmin && <button className="primary-button" type="button" onClick={() => void openCreate()} disabled={roles.length === 0}>Yeni Kullanıcı</button>}
      </div>

      <section className="panel entity-toolbar user-toolbar" aria-label="Kullanıcı filtreleri">
        <div className="form-field"><label htmlFor="managed-user-search">Kullanıcı Ara</label><input id="managed-user-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad veya e-posta" /></div>
        <div className="form-field"><label htmlFor="managed-user-role">Rol</label><select id="managed-user-role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">Tüm roller</option>{availableRoleCodes.map((code) => <option key={code} value={code}>{getRoleLabel(code)}</option>)}</select></div>
        <div className="form-field"><label htmlFor="managed-user-status">Hesap Durumu</label><select id="managed-user-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="inactive">Pasif</option></select></div>
        <button className={`secondary-button entity-filter-clear ${activeFilterCount > 0 ? 'has-active-filters' : ''}`} type="button" disabled={activeFilterCount === 0} onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') }}><span>Filtreleri Temizle</span>{activeFilterCount > 0 && <span className="filter-count-badge" aria-label={`${activeFilterCount} aktif filtre`}>{activeFilterCount}</span>}</button>
      </section>

      {actionError && drawerMode === 'none' && <p className="status-message error-message" role="alert">{actionError}</p>}
      {isLoading && <LoadingSkeleton variant="table" />}
      {!isLoading && loadError && <section className="panel entity-state-panel error-state"><p className="status-message error-message">{loadError}</p><button className="secondary-button" type="button" onClick={() => void loadData()}>Tekrar Dene</button></section>}
      {!isLoading && !loadError && users.length === 0 && <section className="panel entity-state-panel actionable-empty-state"><h2>Henüz kullanıcı bulunmuyor</h2><p>Sistemde görüntülenecek kullanıcı kaydı bulunmamaktadır.</p>{isAdmin && <button className="primary-button" type="button" onClick={() => void openCreate()}>Yeni Kullanıcı</button>}</section>}
      {!isLoading && !loadError && users.length > 0 && filteredUsers.length === 0 && <section className="panel entity-state-panel actionable-empty-state"><h2>Filtrelere uygun kullanıcı bulunamadı</h2><p>Arama ölçütlerini değiştirin veya filtreleri temizleyin.</p><button className="secondary-button" type="button" onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') }}>Filtreleri Temizle</button></section>}

      {!isLoading && !loadError && filteredUsers.length > 0 && (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table user-management-table sticky-columns-table">
              <thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Roller</th><th>Aktif Daire Sayısı</th><th>Hesap Durumu</th><th>Oluşturulma Tarihi</th><th>İşlemler</th></tr></thead>
              <tbody>{filteredUsers.map((managedUser) => (
                <tr key={managedUser.id}>
                  <td><strong>{managedUser.fullName}</strong>{managedUser.id === currentUser?.id && <span className="table-secondary-text">Sizin hesabınız</span>}</td>
                  <td>{managedUser.email}</td>
                  <td><div className="user-role-list">{managedUser.roles.map((code) => <span key={code} className={`user-role-chip ${code.toLowerCase()}`}>{getRoleLabel(code)}</span>)}</div></td>
                  <td>{managedUser.activeUnitCount}</td>
                  <td><span className={`status-badge ${managedUser.isActive ? 'active' : 'inactive'}`}>{managedUser.isActive ? 'Aktif' : 'Pasif'}</span></td>
                  <td>{formatDate(managedUser.createdAt)}</td>
                  <td><RowActionsMenu label={managedUser.fullName} primaryAction={{ label: 'Bağlı Daireler', onSelect: () => onViewUnits(managedUser.email) }} secondaryActions={isAdmin ? [{ label: 'Düzenle', onSelect: () => { void openEdit(managedUser) } }, { label: 'Rolleri Yönet', onSelect: () => { void openRoles(managedUser) } }, { label: managedUser.isActive ? 'Pasif Yap' : 'Aktif Yap', danger: managedUser.isActive, onSelect: () => { void handleStatusChange(managedUser) } }] : []} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {drawerAnimation.shouldRender && drawerMode !== 'none' && (
        <>
          <button className={`drawer-backdrop drawer-${drawerAnimation.phase}`} type="button" aria-label="Kullanıcı formunu kapat" disabled={drawerAnimation.isClosing} onClick={() => void closeDrawer()} />
          <aside ref={drawerRef} tabIndex={-1} className={`management-drawer user-management-drawer drawer-${drawerAnimation.phase}`} role="dialog" aria-modal="true" aria-labelledby="user-drawer-title" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header"><div><p className="eyebrow">Kullanıcı Yönetimi</p><h2 id="user-drawer-title" tabIndex={-1} data-drawer-initial-focus>{drawerMode === 'create' ? 'Yeni Kullanıcı' : drawerMode === 'edit' ? 'Kullanıcıyı Düzenle' : 'Rolleri Yönet'}</h2><p className="drawer-description">Kullanıcı bilgilerini ve yetkili olduğunuz hesap ayarlarını düzenleyin.</p></div><button className="drawer-close-button" type="button" aria-label="Kapat" onClick={() => void closeDrawer()}>×</button></div>
            {actionError && <p className="status-message error-message" role="alert">{actionError}</p>}
            {isDetailLoading ? <LoadingSkeleton variant="detail" /> : (
              <form className="property-form drawer-form" onSubmit={handleSubmit}>
                <h3 className="drawer-section-title form-field-full">Kullanıcı Bilgileri</h3>
                {drawerMode === 'roles' && selectedUser ? (
                  <div className="form-field form-field-full"><span className="readonly-label">Kullanıcı</span><strong>{selectedUser.fullName}</strong><small>{selectedUser.email}</small></div>
                ) : (
                  <>
                    <div className="form-field"><label htmlFor="managed-first-name">Ad *</label><input id="managed-first-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} maxLength={75} required /></div>
                    <div className="form-field"><label htmlFor="managed-last-name">Soyad *</label><input id="managed-last-name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} maxLength={75} required /></div>
                    <div className="form-field form-field-full"><label htmlFor="managed-email">E-posta *</label><input id="managed-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={150} required /></div>
                    {drawerMode === 'create' && <div className="form-field form-field-full"><label htmlFor="managed-password">Geçici Parola *</label><input id="managed-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} maxLength={100} autoComplete="new-password" required /><small className="field-help">En az 8 karakter olmalıdır.</small></div>}
                  </>
                )}

                {(drawerMode === 'create' || drawerMode === 'roles') && <><h3 className="drawer-section-title form-field-full">Rol ve Hesap Durumu</h3><fieldset className="form-field form-field-full role-selection-fieldset"><legend>Roller *</legend><div className="role-selection-grid">{roles.map((role) => <label key={role.id}><input type="checkbox" checked={form.roleCodes.includes(role.code)} onChange={() => toggleRole(role.code)} /><span>{getRoleLabel(role.code)}</span></label>)}</div></fieldset></>}
                {drawerMode === 'create' && <div className="form-field form-field-full checkbox-field"><label htmlFor="managed-is-active"><input id="managed-is-active" type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /><span>Hesap aktif olarak oluşturulsun</span></label></div>}
                {drawerMode === 'edit' && <p className="drawer-info-box form-field-full">Parola ve roller bu formdan değiştirilmez.</p>}
                <div className="drawer-actions form-field-full"><SaveShortcutHint /><button className="secondary-button" type="button" onClick={() => void closeDrawer()}>Vazgeç</button><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</button></div>
              </form>
            )}
          </aside>
        </>
      )}
      {unsavedChangesDialog}
      {confirmation && !unsavedChangesDialog && (
        <ConfirmationDialog
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          danger={confirmation.danger}
          isLoading={isConfirmationRunning}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => { void confirmUserAction() }}
        />
      )}
    </section>
  )
}
