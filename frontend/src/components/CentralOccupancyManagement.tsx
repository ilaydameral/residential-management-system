import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  closeUnitOccupancy,
  createUnitOccupancy,
  getAllUnitOccupancies,
  getOccupancyTypes,
  searchUsers,
  updateUnitOccupancy,
} from '../api'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { formatUnitNumber } from '../utils/unitDisplay'
import type {
  Building,
  CreateUnitOccupancyPayload,
  OccupancyType,
  Property,
  Unit,
  UnitOccupancy,
  UpdateUnitOccupancyPayload,
  UserSearchResult,
} from '../types'

interface CentralOccupancyManagementProps {
  properties: Property[]
  buildings: Building[]
  units: Unit[]
  isReferenceDataLoading: boolean
  referenceDataError: string
  onRetryReferenceData: () => void
  onOpenUnitDetail: (unitId: number) => void
  onDirtyChange: (isDirty: boolean) => void
  initialSearch?: string
}

type DrawerMode = 'none' | 'create' | 'edit' | 'close'
type OccupancyStatus = 'Aktif' | 'Sonlandırılmış' | 'Pasif'

interface OccupancyFormState {
  propertyId: number
  buildingId: number
  unitId: number
  occupancyTypeId: number
  startDate: string
  endDate: string
  isPrimary: boolean
  notes: string
}

function todayAsInputDate(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toInputDate(value: string | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toStartOfDayUtcIso(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString()
}

function toEndOfDayUtcIso(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString()
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const input = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toInputDate(value)
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '—'
}

function getTypeLabel(code: string, fallback = ''): string {
  if (code === 'OWNER') return 'Malik'
  if (code === 'TENANT') return 'Kiracı'
  if (code === 'HOUSEHOLD_MEMBER') return 'Hane Üyesi'
  return fallback || 'Belirtilmemiş'
}

function getStatus(occupancy: UnitOccupancy): OccupancyStatus {
  const today = todayAsInputDate()
  const endDate = toInputDate(occupancy.endDate)
  if (endDate && (endDate < today || !occupancy.isActive)) return 'Sonlandırılmış'
  if (!occupancy.isActive || toInputDate(occupancy.startDate) > today) return 'Pasif'
  return 'Aktif'
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function createInitialForm(defaultTypeId = 0): OccupancyFormState {
  return {
    propertyId: 0,
    buildingId: 0,
    unitId: 0,
    occupancyTypeId: defaultTypeId,
    startDate: todayAsInputDate(),
    endDate: '',
    isPrimary: false,
    notes: '',
  }
}

export function CentralOccupancyManagement({
  properties,
  buildings,
  units,
  isReferenceDataLoading,
  referenceDataError,
  onRetryReferenceData,
  onOpenUnitDetail,
  onDirtyChange,
  initialSearch = '',
}: CentralOccupancyManagementProps) {
  const [occupancies, setOccupancies] = useState<UnitOccupancy[]>([])
  const [occupancyTypes, setOccupancyTypes] = useState<OccupancyType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [buildingFilter, setBuildingFilter] = useState('all')
  const [unitSearch, setUnitSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [drawerMode, setDrawerMode] = useState<DrawerMode>('none')
  const [activeOccupancy, setActiveOccupancy] = useState<UnitOccupancy | null>(null)
  const [form, setForm] = useState<OccupancyFormState>(createInitialForm)
  const [formBaseline, setFormBaseline] = useState<OccupancyFormState>(createInitialForm)
  const [closeDate, setCloseDate] = useState(todayAsInputDate())
  const [closeDateBaseline, setCloseDateBaseline] = useState(todayAsInputDate())

  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [userSearchError, setUserSearchError] = useState('')

  const isDirty =
    drawerMode === 'create'
      ? JSON.stringify(form) !== JSON.stringify(formBaseline) || selectedUser !== null || userQuery.trim() !== ''
      : drawerMode === 'edit'
        ? JSON.stringify(form) !== JSON.stringify(formBaseline)
        : drawerMode === 'close'
          ? closeDate !== closeDateBaseline
          : false
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isDirty)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const [records, types] = await Promise.all([getAllUnitOccupancies(), getOccupancyTypes()])
      setOccupancies(records)
      setOccupancyTypes(types)
    } catch (loadFailure) {
      setOccupancies([])
      setOccupancyTypes([])
      setLoadError(getErrorMessage(loadFailure, 'Site sakinleri yüklenemedi.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    setSearch(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  useEffect(() => {
    const query = userQuery.trim()
    if (drawerMode !== 'create' || selectedUser || query.length < 2) {
      setUserResults([])
      setIsSearchingUsers(false)
      setUserSearchError('')
      return
    }

    let cancelled = false
    setIsSearchingUsers(true)
    setUserSearchError('')
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchUsers(query)
        if (!cancelled) setUserResults(results)
      } catch (searchError) {
        if (!cancelled) {
          setUserResults([])
          setUserSearchError(getErrorMessage(searchError, 'Kullanıcı araması yapılamadı.'))
        }
      } finally {
        if (!cancelled) setIsSearchingUsers(false)
      }
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [drawerMode, selectedUser, userQuery])

  const filterBuildings = useMemo(
    () => propertyFilter === 'all' ? [] : buildings.filter((item) => item.propertyId === Number(propertyFilter)),
    [buildings, propertyFilter]
  )
  const formBuildings = useMemo(
    () => buildings.filter((item) => item.propertyId === form.propertyId && (drawerMode === 'edit' || item.isActive)),
    [buildings, drawerMode, form.propertyId]
  )
  const formUnits = useMemo(
    () => units.filter((item) => item.buildingId === form.buildingId && (drawerMode === 'edit' || item.isActive)),
    [drawerMode, form.buildingId, units]
  )

  const filteredOccupancies = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')
    const normalizedUnit = unitSearch.trim().toLocaleLowerCase('tr-TR')
    return occupancies.filter((occupancy) => {
      const matchesUser = !normalizedSearch ||
        occupancy.userFullName.toLocaleLowerCase('tr-TR').includes(normalizedSearch) ||
        occupancy.userEmail.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      const matchesProperty = propertyFilter === 'all' || occupancy.propertyId === Number(propertyFilter)
      const matchesBuilding = buildingFilter === 'all' || occupancy.buildingId === Number(buildingFilter)
      const matchesUnit = !normalizedUnit || formatUnitNumber(occupancy.unitNumber).toLocaleLowerCase('tr-TR').includes(normalizedUnit)
      const matchesType = typeFilter === 'all' || occupancy.occupancyTypeId === Number(typeFilter)
      const matchesStatus = statusFilter === 'all' || getStatus(occupancy) === statusFilter
      return matchesUser && matchesProperty && matchesBuilding && matchesUnit && matchesType && matchesStatus
    })
  }, [buildingFilter, occupancies, propertyFilter, search, statusFilter, typeFilter, unitSearch])

  const clearDrawerState = () => {
    setDrawerMode('none')
    setActiveOccupancy(null)
    setSelectedUser(null)
    setUserQuery('')
    setUserResults([])
    setUserSearchError('')
    setError('')
  }

  const closeDrawer = async () => {
    if (!(await requestDiscard())) return
    clearDrawerState()
  }

  const openCreate = async () => {
    if (!(await requestDiscard())) return
    const defaultType = occupancyTypes.find((type) => type.code === 'TENANT') ?? occupancyTypes[0]
    const initial = createInitialForm(defaultType?.id ?? 0)
    setError('')
    setActiveOccupancy(null)
    setSelectedUser(null)
    setUserQuery('')
    setForm(initial)
    setFormBaseline(initial)
    setDrawerMode('create')
  }

  const openEdit = async (occupancy: UnitOccupancy) => {
    if (!(await requestDiscard())) return
    const editForm: OccupancyFormState = {
      propertyId: occupancy.propertyId,
      buildingId: occupancy.buildingId,
      unitId: occupancy.unitId,
      occupancyTypeId: occupancy.occupancyTypeId,
      startDate: toInputDate(occupancy.startDate),
      endDate: toInputDate(occupancy.endDate),
      isPrimary: occupancy.isPrimary,
      notes: occupancy.notes || '',
    }
    setError('')
    setActiveOccupancy(occupancy)
    setForm(editForm)
    setFormBaseline(editForm)
    setDrawerMode('edit')
  }

  const openClose = async (occupancy: UnitOccupancy) => {
    if (!(await requestDiscard())) return
    const initialDate = todayAsInputDate()
    setError('')
    setActiveOccupancy(occupancy)
    setCloseDate(initialDate)
    setCloseDateBaseline(initialDate)
    setDrawerMode('close')
  }

  const validateForm = (): boolean => {
    if (drawerMode === 'create' && !selectedUser) {
      setError('Lütfen atanacak kullanıcıyı arayıp seçin.')
      return false
    }
    if (!form.unitId || !form.occupancyTypeId) {
      setError('Lütfen yapı, blok, daire ve ikamet türü alanlarını doldurun.')
      return false
    }
    if (form.endDate && form.endDate < form.startDate) {
      setError('Bitiş tarihi başlangıç tarihinden önce olamaz.')
      return false
    }
    return true
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!validateForm()) return
    setIsSubmitting(true)
    try {
      const commonPayload: UpdateUnitOccupancyPayload = {
        occupancyTypeId: form.occupancyTypeId,
        startDate: toStartOfDayUtcIso(form.startDate),
        endDate: form.endDate ? toEndOfDayUtcIso(form.endDate) : null,
        isPrimary: form.isPrimary,
        notes: form.notes.trim() || null,
      }
      if (drawerMode === 'create' && selectedUser) {
        const createPayload: CreateUnitOccupancyPayload = { ...commonPayload, userId: selectedUser.id }
        await createUnitOccupancy(form.unitId, createPayload)
      } else if (drawerMode === 'edit' && activeOccupancy) {
        await updateUnitOccupancy(activeOccupancy.id, commonPayload)
      }
      clearDrawerState()
      await loadData()
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Sakin kaydı kaydedilemedi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseOccupancy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!activeOccupancy) return
    if (closeDate < toInputDate(activeOccupancy.startDate)) {
      setError('Bitiş tarihi başlangıç tarihinden önce olamaz.')
      return
    }
    if (!window.confirm(`${activeOccupancy.userFullName} için sakin kaydını sonlandırmak istediğinizden emin misiniz?`)) return
    setIsSubmitting(true)
    try {
      await closeUnitOccupancy(activeOccupancy.id, { endDate: toEndOfDayUtcIso(closeDate) })
      clearDrawerState()
      await loadData()
    } catch (closeError) {
      setError(getErrorMessage(closeError, 'Sakin kaydı sonlandırılamadı.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderUserPicker = () => (
    <div className="form-field form-field-full user-search-field">
      <label htmlFor="central-occupancy-user">Kullanıcı *</label>
      {selectedUser ? (
        <div className="selected-user-box">
          <div><strong>{selectedUser.fullName}</strong><span>{selectedUser.email}</span></div>
          <button className="text-button" type="button" onClick={() => { setSelectedUser(null); setUserQuery('') }}>Değiştir</button>
        </div>
      ) : (
        <>
          <input id="central-occupancy-user" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Ad, soyad veya e-posta (en az 2 karakter)" autoComplete="off" />
          {userQuery.trim().length > 0 && userQuery.trim().length < 2 && <small className="field-help">Arama için en az 2 karakter girin.</small>}
          {isSearchingUsers && <small className="field-help">Kullanıcılar aranıyor...</small>}
          {userSearchError && <small className="field-error">{userSearchError}</small>}
          {userQuery.trim().length >= 2 && !isSearchingUsers && !userSearchError && (
            <div className="user-search-results">
              {userResults.length === 0 ? <span className="no-user-result">Aktif kullanıcı bulunamadı.</span> : userResults.map((result) => (
                <button key={result.id} className="user-search-result" type="button" onClick={() => { setSelectedUser(result); setUserQuery(result.fullName); setUserResults([]) }}>
                  <strong>{result.fullName}</strong><span>{result.email}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )

  const hasActiveFilters = Boolean(search || propertyFilter !== 'all' || buildingFilter !== 'all' || unitSearch || typeFilter !== 'all' || statusFilter !== 'all')
  const combinedError = loadError || referenceDataError
  const combinedLoading = isLoading || isReferenceDataLoading

  return (
    <section className="central-occupancy-view">
      <div className="entity-page-actions residents-page-actions">
        <p>{!combinedError && !combinedLoading ? `${filteredOccupancies.length} sakin kaydı gösteriliyor.` : 'Aktif ve geçmiş sakin ilişkilerini tek ekrandan yönetin.'}</p>
        <button className="primary-button" type="button" onClick={() => void openCreate()} disabled={occupancyTypes.length === 0 || isReferenceDataLoading}>Yeni Sakin Ata</button>
      </div>

      <section className="panel entity-toolbar residents-toolbar" aria-label="Site sakinleri filtreleri">
        <div className="residents-filter-grid">
          <div className="form-field"><label htmlFor="resident-search">Sakin Ara</label><input id="resident-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad veya e-posta" /></div>
          <div className="form-field"><label htmlFor="resident-property">Yapı</label><select id="resident-property" value={propertyFilter} onChange={(event) => { setPropertyFilter(event.target.value); setBuildingFilter('all') }}><option value="all">Tüm yapılar</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="resident-building">Blok / Bina</label><select id="resident-building" value={buildingFilter} disabled={propertyFilter === 'all'} onChange={(event) => setBuildingFilter(event.target.value)}><option value="all">{propertyFilter === 'all' ? 'Önce yapı seçin' : 'Tüm bloklar'}</option>{filterBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="resident-unit">Daire / Bölüm No</label><input id="resident-unit" value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Örn: 12, A-3" /></div>
          <div className="form-field"><label htmlFor="resident-type">İkamet Türü</label><select id="resident-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Tüm türler</option>{occupancyTypes.map((type) => <option key={type.id} value={type.id}>{getTypeLabel(type.code, type.name)}</option>)}</select></div>
          <div className="form-field"><label htmlFor="resident-status">Durum</label><select id="resident-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tüm durumlar</option><option value="Aktif">Aktif</option><option value="Sonlandırılmış">Sonlandırılmış</option><option value="Pasif">Pasif</option></select></div>
        </div>
        <button className="secondary-button entity-filter-clear" type="button" disabled={!hasActiveFilters} onClick={() => { setSearch(''); setPropertyFilter('all'); setBuildingFilter('all'); setUnitSearch(''); setTypeFilter('all'); setStatusFilter('all') }}>Filtreleri Temizle</button>
      </section>

      {combinedLoading && <p className="status-message">Site sakinleri yükleniyor...</p>}
      {!combinedLoading && combinedError && <section className="panel empty-state-box"><p className="status-message error-message">{combinedError}</p><button className="secondary-button" type="button" onClick={() => { void loadData(); onRetryReferenceData() }}>Tekrar Dene</button></section>}
      {!combinedLoading && !combinedError && occupancies.length === 0 && <section className="panel empty-state-box"><h2>Henüz sakin kaydı bulunmuyor</h2><p>İlk sakin ilişkisini oluşturmak için “Yeni Sakin Ata” butonunu kullanın.</p></section>}
      {!combinedLoading && !combinedError && occupancies.length > 0 && filteredOccupancies.length === 0 && <section className="panel empty-state-box"><h2>Filtrelere uygun kayıt bulunamadı</h2><p>Arama ölçütlerini değiştirin veya filtreleri temizleyin.</p></section>}

      {!combinedLoading && !combinedError && filteredOccupancies.length > 0 && (
        <section className="panel entity-table-panel residents-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table residents-table">
              <thead><tr><th>Sakin Adı</th><th>E-posta</th><th>Yapı</th><th>Blok / Bina</th><th>Daire / Bölüm No</th><th>İkamet Türü</th><th>Birincil Durumu</th><th>Başlangıç</th><th>Bitiş</th><th>Durum</th><th>İşlemler</th></tr></thead>
              <tbody>{filteredOccupancies.map((occupancy) => {
                const status = getStatus(occupancy)
                return <tr key={occupancy.id}>
                  <td data-label="Sakin Adı"><strong>{occupancy.userFullName}</strong></td>
                  <td data-label="E-posta">{occupancy.userEmail}</td>
                  <td data-label="Yapı">{occupancy.propertyName}</td>
                  <td data-label="Blok / Bina">{occupancy.buildingName}</td>
                  <td data-label="Daire / Bölüm No">{formatUnitNumber(occupancy.unitNumber)}</td>
                  <td data-label="İkamet Türü">{getTypeLabel(occupancy.occupancyTypeCode, occupancy.occupancyTypeName)}</td>
                  <td data-label="Birincil Durumu">{occupancy.isPrimary ? (status === 'Aktif' ? 'Birincil Sakin' : 'Döneminde Birincil') : '—'}</td>
                  <td data-label="Başlangıç">{formatDate(occupancy.startDate)}</td>
                  <td data-label="Bitiş">{formatDate(occupancy.endDate)}</td>
                  <td data-label="Durum"><span className={`status-badge ${status === 'Aktif' ? 'active' : 'inactive'}`}>{status}</span></td>
                  <td data-label="İşlemler"><div className="compact-actions"><button type="button" onClick={() => onOpenUnitDetail(occupancy.unitId)}>Daire Detayı</button><button type="button" onClick={() => void openEdit(occupancy)}>Düzenle</button>{status === 'Aktif' && <button className="danger" type="button" onClick={() => void openClose(occupancy)}>Sonlandır</button>}</div></td>
                </tr>
              })}</tbody>
            </table>
          </div>
        </section>
      )}

      {drawerMode !== 'none' && (
        <>
          <button className="drawer-backdrop" type="button" aria-label="Sakin formunu kapat" onClick={() => void closeDrawer()} />
          <aside className="management-drawer occupancy-management-drawer" role="dialog" aria-modal="true" aria-labelledby="occupancy-drawer-title">
            <div className="drawer-header"><div><p className="eyebrow">Sakin Yönetimi</p><h2 id="occupancy-drawer-title">{drawerMode === 'create' ? 'Yeni Sakin Ata' : drawerMode === 'edit' ? 'Sakin Kaydını Düzenle' : 'Sakin Kaydını Sonlandır'}</h2></div><button className="drawer-close-button" type="button" aria-label="Kapat" onClick={() => void closeDrawer()}>×</button></div>
            {error && <p className="status-message error-message" role="alert">{error}</p>}

            {drawerMode === 'close' && activeOccupancy ? (
              <form className="property-form drawer-form" onSubmit={handleCloseOccupancy}>
                <div className="form-field form-field-full readonly-field"><span className="readonly-label">Sonlandırılacak Kayıt</span><strong>{activeOccupancy.userFullName}</strong><small>{activeOccupancy.propertyName} · {activeOccupancy.buildingName} · {formatUnitNumber(activeOccupancy.unitNumber)}</small></div>
                <div className="form-field form-field-full"><label htmlFor="central-close-date">Bitiş Tarihi *</label><input id="central-close-date" type="date" value={closeDate} onChange={(event) => setCloseDate(event.target.value)} required /></div>
                <div className="drawer-actions form-field-full"><button className="secondary-button" type="button" onClick={() => void closeDrawer()}>Vazgeç</button><button className="action-button danger-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sonlandırılıyor...' : 'Sonlandır'}</button></div>
              </form>
            ) : (
              <form className="property-form drawer-form" onSubmit={handleSubmit}>
                {drawerMode === 'create' ? renderUserPicker() : activeOccupancy && <div className="form-field form-field-full readonly-field"><span className="readonly-label">Kullanıcı ve Daire</span><strong>{activeOccupancy.userFullName}</strong><small>{activeOccupancy.userEmail} · {activeOccupancy.propertyName} · {activeOccupancy.buildingName} · {formatUnitNumber(activeOccupancy.unitNumber)}</small></div>}
                <div className="form-field"><label htmlFor="central-form-property">Yapı *</label><select id="central-form-property" value={form.propertyId || ''} disabled={drawerMode === 'edit'} onChange={(event) => setForm({ ...form, propertyId: Number(event.target.value), buildingId: 0, unitId: 0 })} required><option value="">Yapı seçin</option>{properties.filter((item) => drawerMode === 'edit' || item.isActive).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div>
                <div className="form-field"><label htmlFor="central-form-building">Blok / Bina *</label><select id="central-form-building" value={form.buildingId || ''} disabled={drawerMode === 'edit' || !form.propertyId} onChange={(event) => setForm({ ...form, buildingId: Number(event.target.value), unitId: 0 })} required><option value="">Blok seçin</option>{formBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></div>
                <div className="form-field form-field-full"><label htmlFor="central-form-unit">Daire / Bölüm *</label><select id="central-form-unit" value={form.unitId || ''} disabled={drawerMode === 'edit' || !form.buildingId} onChange={(event) => setForm({ ...form, unitId: Number(event.target.value) })} required><option value="">Daire seçin</option>{formUnits.map((unit) => <option key={unit.id} value={unit.id}>{formatUnitNumber(unit.unitNumber)}</option>)}</select></div>
                <div className="form-field"><label htmlFor="central-form-type">İkamet Türü *</label><select id="central-form-type" value={form.occupancyTypeId || ''} onChange={(event) => setForm({ ...form, occupancyTypeId: Number(event.target.value) })} required><option value="">İkamet türü seçin</option>{occupancyTypes.map((type) => <option key={type.id} value={type.id}>{getTypeLabel(type.code, type.name)}</option>)}</select></div>
                <div className="form-field"><label htmlFor="central-form-start">Başlangıç Tarihi *</label><input id="central-form-start" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></div>
                <div className="form-field"><label htmlFor="central-form-end">Bitiş Tarihi</label><input id="central-form-end" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required={drawerMode === 'edit' && activeOccupancy ? getStatus(activeOccupancy) !== 'Aktif' : false} /></div>
                <div className="form-field checkbox-field"><label htmlFor="central-form-primary"><input id="central-form-primary" type="checkbox" checked={form.isPrimary} onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })} /><span>Birincil Sakin</span></label><small className="field-help">Bir dairede aynı anda yalnızca bir aktif birincil sakin olabilir.</small></div>
                <div className="form-field form-field-full"><label htmlFor="central-form-notes">Notlar</label><textarea id="central-form-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={500} rows={3} placeholder="İsteğe bağlı not" /></div>
                {drawerMode === 'edit' && activeOccupancy && getStatus(activeOccupancy) !== 'Aktif' && <p className="status-message empty-state-box form-field-full">Sonlandırılmış veya pasif kayıt güncellemeyle yeniden aktif hâle getirilemez.</p>}
                <div className="drawer-actions form-field-full"><button className="secondary-button" type="button" onClick={() => void closeDrawer()}>Vazgeç</button><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</button></div>
              </form>
            )}
          </aside>
        </>
      )}
      {unsavedChangesDialog}
    </section>
  )
}
