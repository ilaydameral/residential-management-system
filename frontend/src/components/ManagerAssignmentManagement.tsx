import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createManagerAssignment,
  endManagerAssignment,
  getBuildingsByProperty,
  getManagerAssignments,
  getProperties,
  getUsers,
} from '../api'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import type { Building, ManagedUser, ManagerAssignment, Property } from '../types'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'
import { SaveShortcutHint } from './SaveShortcutHint'

interface ManagerAssignmentManagementProps {
  onDirtyChange: (isDirty: boolean) => void
}

interface AssignmentFormState {
  managerUserId: number
  propertyId: number
  buildingId: number | null
}

const initialForm: AssignmentFormState = {
  managerUserId: 0,
  propertyId: 0,
  buildingId: null,
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function ManagerAssignmentManagement({ onDirtyChange }: ManagerAssignmentManagementProps) {
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState<ManagerAssignment[]>([])
  const [managers, setManagers] = useState<ManagedUser[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isBuildingsLoading, setIsBuildingsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all')
  const [search, setSearch] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [form, setForm] = useState<AssignmentFormState>(initialForm)
  const [createConfirmationOpen, setCreateConfirmationOpen] = useState(false)
  const [endingAssignment, setEndingAssignment] = useState<ManagerAssignment | null>(null)
  const [endReason, setEndReason] = useState('')

  const isDirty = isDrawerOpen && JSON.stringify(form) !== JSON.stringify(initialForm)
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isDirty)
  const drawerAnimation = useAnimatedDrawer(isDrawerOpen)

  const resetDrawerState = useCallback(() => {
    setIsDrawerOpen(false)
    setForm(initialForm)
    setBuildings([])
    setActionError('')
    setCreateConfirmationOpen(false)
  }, [])

  const closeDrawer = useCallback(async () => {
    if (!(await requestDiscard())) return
    drawerAnimation.close(resetDrawerState)
  }, [drawerAnimation, requestDiscard, resetDrawerState])

  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.shouldRender && !drawerAnimation.isClosing,
    onClose: () => { void closeDrawer() },
    isSaving: isSubmitting || createConfirmationOpen,
  })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const [assignmentData, userData, propertyData] = await Promise.all([
        getManagerAssignments(),
        getUsers(),
        getProperties(false),
      ])
      setAssignments(assignmentData)
      setManagers(userData.filter((user) => user.isActive && user.roles.includes('MANAGER')))
      setProperties(propertyData.filter((property) => property.isActive))
    } catch (error) {
      setAssignments([])
      setLoadError(getErrorMessage(error, 'Yönetici atamaları yüklenemedi.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const loadBuildings = async (propertyId: number) => {
    setBuildings([])
    if (!propertyId) return
    setIsBuildingsLoading(true)
    setActionError('')
    try {
      const data = await getBuildingsByProperty(propertyId, false)
      setBuildings(data.filter((building) => building.isActive))
    } catch (error) {
      setActionError(getErrorMessage(error, 'Bloklar yüklenemedi.'))
    } finally {
      setIsBuildingsLoading(false)
    }
  }

  const openCreate = () => {
    setActionError('')
    setForm(initialForm)
    setBuildings([])
    setIsDrawerOpen(true)
  }

  const handlePropertyChange = (propertyId: number) => {
    setForm((current) => ({ ...current, propertyId, buildingId: null }))
    void loadBuildings(propertyId)
  }

  const createAssignment = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setActionError('')
    try {
      await createManagerAssignment(form)
      showToast('Yönetici ataması oluşturuldu.')
      setCreateConfirmationOpen(false)
      drawerAnimation.close(resetDrawerState)
      await loadData()
    } catch (error) {
      setCreateConfirmationOpen(false)
      setActionError(getErrorMessage(error, 'Yönetici ataması oluşturulamadı.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionError('')
    if (!form.managerUserId || !form.propertyId) {
      setActionError('Yönetici ve yapı seçimi zorunludur.')
      return
    }
    if (form.buildingId == null) {
      setCreateConfirmationOpen(true)
      return
    }
    void createAssignment()
  }

  const confirmEndAssignment = async () => {
    if (!endingAssignment || isSubmitting) return
    setIsSubmitting(true)
    setActionError('')
    try {
      await endManagerAssignment(endingAssignment.id, {
        endReason: endReason.trim() || null,
      })
      showToast('Yönetici ataması sonlandırıldı.')
      setEndingAssignment(null)
      setEndReason('')
      await loadData()
    } catch (error) {
      setEndingAssignment(null)
      setEndReason('')
      setActionError(getErrorMessage(error, 'Yönetici ataması sonlandırılamadı.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR')
    return assignments.filter((assignment) => {
      const matchesSearch = !query || [
        assignment.managerFullName,
        assignment.managerEmail,
        assignment.propertyName,
        assignment.buildingName ?? '',
        assignment.buildingCode ?? '',
      ].some((value) => value.toLocaleLowerCase('tr-TR').includes(query))
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' ? assignment.isActive : !assignment.isActive)
      return matchesSearch && matchesStatus
    })
  }, [assignments, search, statusFilter])

  const activeFilterCount = [search.trim() !== '', statusFilter !== 'all'].filter(Boolean).length

  return (
    <section className="manager-assignment-view entity-management-view" aria-busy={isLoading}>
      <div className="entity-page-actions">
        <p>{!isLoading && !loadError ? `${filteredAssignments.length} atama gösteriliyor.` : 'Yönetici sorumluluklarını merkezi olarak yönetin.'}</p>
        <button className="primary-button" type="button" onClick={openCreate} disabled={isLoading || managers.length === 0 || properties.length === 0}>
          Yeni Atama
        </button>
      </div>

      <section className="panel entity-toolbar manager-assignment-toolbar" aria-label="Yönetici ataması filtreleri">
        <div className="form-field">
          <label htmlFor="manager-assignment-search">Atama Ara</label>
          <input id="manager-assignment-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Yönetici, yapı veya blok" />
        </div>
        <div className="form-field">
          <label htmlFor="manager-assignment-status">Durum</label>
          <select id="manager-assignment-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">Tüm atamalar</option>
            <option value="active">Aktif</option>
            <option value="ended">Geçmiş</option>
          </select>
        </div>
        <button className={`secondary-button entity-filter-clear ${activeFilterCount > 0 ? 'has-active-filters' : ''}`} type="button" disabled={activeFilterCount === 0} onClick={() => { setSearch(''); setStatusFilter('all') }}>
          <span>Filtreleri Temizle</span>
          {activeFilterCount > 0 && <span className="filter-count-badge" aria-label={`${activeFilterCount} aktif filtre`}>{activeFilterCount}</span>}
        </button>
      </section>

      {actionError && !isDrawerOpen && <p className="status-message error-message" role="alert">{actionError}</p>}
      {isLoading && <LoadingSkeleton variant="table" />}
      {!isLoading && loadError && <section className="panel entity-state-panel error-state"><p className="status-message error-message" role="alert">{loadError}</p><button className="secondary-button" type="button" onClick={() => void loadData()}>Tekrar Dene</button></section>}
      {!isLoading && !loadError && assignments.length === 0 && <section className="panel entity-state-panel actionable-empty-state"><h2>Henüz yönetici ataması bulunmuyor</h2><p>Yeni bir yönetici sorumluluğu oluşturarak başlayabilirsiniz.</p><button className="primary-button" type="button" onClick={openCreate} disabled={managers.length === 0 || properties.length === 0}>Yeni Atama</button></section>}
      {!isLoading && !loadError && assignments.length > 0 && filteredAssignments.length === 0 && <section className="panel entity-state-panel actionable-empty-state"><h2>Filtrelere uygun atama bulunamadı</h2><p>Arama ölçütlerini değiştirin veya filtreleri temizleyin.</p><button className="secondary-button" type="button" onClick={() => { setSearch(''); setStatusFilter('all') }}>Filtreleri Temizle</button></section>}

      {!isLoading && !loadError && filteredAssignments.length > 0 && (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table manager-assignment-table sticky-columns-table">
              <thead><tr><th>Yönetici</th><th>Kapsam</th><th>Yapı</th><th>Blok / Bina</th><th>Atanma</th><th>Durum</th><th className="manager-assignment-end-column">Sonlandırma</th><th className="manager-assignment-actions-column">İşlemler</th></tr></thead>
              <tbody>{filteredAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td><strong>{assignment.managerFullName}</strong><span className="table-secondary-text">{assignment.managerEmail}</span></td>
                  <td><span className="status-badge primary-badge">{assignment.scopeType === 'PROPERTY' ? 'Yapı Geneli' : 'Blok'}</span></td>
                  <td>{assignment.propertyName}</td>
                  <td>{assignment.buildingName ? `${assignment.buildingName}${assignment.buildingCode ? ` (${assignment.buildingCode})` : ''}` : 'Tüm bloklar'}</td>
                  <td><strong>{formatDateTime(assignment.assignedAt)}</strong><span className="table-secondary-text">Atayan: {assignment.assignedByFullName}</span></td>
                  <td><span className={`status-badge ${assignment.isActive ? 'active' : 'inactive'}`}>{assignment.isActive ? 'Aktif' : 'Geçmiş'}</span></td>
                  <td className="manager-assignment-end-cell">{assignment.isActive ? '—' : <div className="manager-assignment-end-details"><strong>{formatDateTime(assignment.endedAt)}</strong><span className="table-secondary-text">{assignment.endedByFullName ? `Sonlandıran: ${assignment.endedByFullName}` : 'Sistem tarafından sonlandırıldı'}</span>{assignment.endReason && <span className="table-secondary-text end-reason">Neden: {assignment.endReason}</span>}</div>}</td>
                  <td className="manager-assignment-actions-cell">{assignment.isActive ? <button className="action-button danger-btn" type="button" onClick={() => { setActionError(''); setEndReason(''); setEndingAssignment(assignment) }}>Sonlandır</button> : <span className="table-secondary-text">İşlem yok</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {drawerAnimation.shouldRender && isDrawerOpen && (
        <>
          <button className={`drawer-backdrop drawer-${drawerAnimation.phase}`} type="button" aria-label="Atama formunu kapat" disabled={drawerAnimation.isClosing} onClick={() => void closeDrawer()} />
          <aside ref={drawerRef} tabIndex={-1} className={`management-drawer drawer-${drawerAnimation.phase}`} role="dialog" aria-modal="true" aria-labelledby="manager-assignment-drawer-title" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header"><div><p className="eyebrow">Yönetici Atamaları</p><h2 id="manager-assignment-drawer-title" tabIndex={-1} data-drawer-initial-focus>Yeni Atama</h2><p className="drawer-description">Bir site yöneticisini yapı geneline veya belirli bir bloğa atayın.</p></div><button className="drawer-close-button" type="button" aria-label="Kapat" onClick={() => void closeDrawer()}>×</button></div>
            {actionError && <p className="status-message error-message" role="alert">{actionError}</p>}
            <form className="property-form drawer-form" onSubmit={handleCreateSubmit}>
              <h3 className="drawer-section-title form-field-full">Atama Bilgileri</h3>
              <div className="form-field form-field-full"><label htmlFor="assignment-manager">Site Yöneticisi *</label><select id="assignment-manager" value={form.managerUserId || ''} onChange={(event) => setForm((current) => ({ ...current, managerUserId: Number(event.target.value) }))} required><option value="">Yönetici seçin</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.fullName} — {manager.email}</option>)}</select>{managers.length === 0 && <small className="field-help">Atanabilecek aktif Site Yöneticisi bulunmuyor.</small>}</div>
              <div className="form-field form-field-full"><label htmlFor="assignment-property">Yapı *</label><select id="assignment-property" value={form.propertyId || ''} onChange={(event) => handlePropertyChange(Number(event.target.value))} required><option value="">Yapı seçin</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div>
              <div className="form-field form-field-full"><label htmlFor="assignment-building">Blok / Bina</label><select id="assignment-building" value={form.buildingId ?? ''} onChange={(event) => setForm((current) => ({ ...current, buildingId: event.target.value ? Number(event.target.value) : null }))} disabled={!form.propertyId || isBuildingsLoading}><option value="">Tüm yapı (yapı kapsamı)</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.name}{building.code ? ` (${building.code})` : ''}</option>)}</select><small className="field-help">Blok seçmezseniz yönetici yapının tamamından sorumlu olur.</small></div>
              <div className="drawer-actions form-field-full"><SaveShortcutHint /><button className="secondary-button" type="button" onClick={() => void closeDrawer()}>Vazgeç</button><button className="primary-button" type="submit" disabled={isSubmitting || isBuildingsLoading || managers.length === 0}>{isSubmitting ? 'Oluşturuluyor...' : 'Atamayı Oluştur'}</button></div>
            </form>
          </aside>
        </>
      )}

      {unsavedChangesDialog}
      {createConfirmationOpen && !unsavedChangesDialog && (
        <ConfirmationDialog title="Yapı Kapsamlı Atama Oluştur" message="Bu atama oluşturulduğunda yöneticinin aynı yapıdaki mevcut aktif blok atamaları sonlandırılabilir. Devam etmek istiyor musunuz?" confirmLabel="Atamayı Oluştur" isLoading={isSubmitting} onCancel={() => setCreateConfirmationOpen(false)} onConfirm={() => void createAssignment()} />
      )}
      {endingAssignment && !unsavedChangesDialog && (
        <ConfirmationDialog title="Yönetici Atamasını Sonlandır" message={`${endingAssignment.managerFullName} için ${endingAssignment.propertyName} kapsamındaki atamayı sonlandırmak istediğinizden emin misiniz?`} confirmLabel="Sonlandır" danger isLoading={isSubmitting} onCancel={() => { setEndingAssignment(null); setEndReason('') }} onConfirm={() => void confirmEndAssignment()}>
          <div className="form-field confirmation-form-field"><label htmlFor="manager-assignment-end-reason">Sonlandırma Nedeni (isteğe bağlı)</label><textarea id="manager-assignment-end-reason" value={endReason} onChange={(event) => setEndReason(event.target.value)} maxLength={500} rows={3} placeholder="Kısa bir açıklama yazabilirsiniz" /><small>{endReason.length}/500</small></div>
        </ConfirmationDialog>
      )}
    </section>
  )
}
