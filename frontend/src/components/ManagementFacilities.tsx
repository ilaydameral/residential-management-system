import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  approveFacilityReservation,
  createFacility,
  createMaintenanceBlock,
  deleteMaintenanceBlock,
  getBuildings,
  getFacilities,
  getMaintenanceBlocks,
  getManagementFacilityReservations,
  getProperties,
  rejectFacilityReservation,
  setFacilityStatus,
  updateFacility,
} from '../api'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { useRealtime } from '../realtime/useRealtime'
import type {
  Building,
  CommonFacility,
  CreateCommonFacilityPayload,
  CreateMaintenanceBlockPayload,
  FacilityMaintenanceBlock,
  FacilityReservation,
  Property,
  UpdateCommonFacilityPayload,
} from '../types'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'
import { RowActionsMenu } from './RowActionsMenu'
import { SaveShortcutHint } from './SaveShortcutHint'

const STATUS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Onay Bekliyor', className: 'status-badge warning' },
  APPROVED: { label: 'Onaylandı', className: 'status-badge success' },
  REJECTED: { label: 'Reddedildi', className: 'status-badge danger' },
  CANCELLED: { label: 'İptal Edildi', className: 'status-badge secondary' },
  COMPLETED: { label: 'Tamamlandı', className: 'status-badge info' },
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function ManagementFacilities() {
  const realtime = useRealtime()

  // Primary Tabs
  const [activeTab, setActiveTab] = useState<'facilities' | 'reservations' | 'maintenance'>('facilities')

  // Shared Data
  const [facilities, setFacilities] = useState<CommonFacility[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [reservations, setReservations] = useState<FacilityReservation[]>([])
  const [maintenanceBlocks, setMaintenanceBlocks] = useState<FacilityMaintenanceBlock[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Reservation & Facility Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [facilityFilter, setFacilityFilter] = useState<number | 'ALL'>('ALL')
  const [facilitySearch, setFacilitySearch] = useState('')
  const [facilityPropFilter, setFacilityPropFilter] = useState<number | 'all'>('all')
  const [facilityBldgFilter, setFacilityBldgFilter] = useState<number | 'all'>('all')
  const [facilityStatusFilter, setFacilityStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Facility Form Drawer
  const [isFacilityDrawerOpen, setIsFacilityDrawerOpen] = useState(false)
  const [editingFacility, setEditingFacility] = useState<CommonFacility | null>(null)
  const [facilityFormData, setFacilityFormData] = useState<CreateCommonFacilityPayload>({
    propertyId: 0,
    buildingId: null,
    name: '',
    description: '',
    locationHint: '',
    capacity: 10,
    openingTime: '08:00',
    closingTime: '22:00',
    slotDurationMinutes: 60,
    requiresManagerApproval: false,
    maxActiveReservationsPerResident: 2,
    cancellationLeadTimeHours: 2,
  })
  const [facilityFormBaseline, setFacilityFormBaseline] = useState<CreateCommonFacilityPayload>({
    propertyId: 0,
    buildingId: null,
    name: '',
    description: '',
    locationHint: '',
    capacity: 10,
    openingTime: '08:00',
    closingTime: '22:00',
    slotDurationMinutes: 60,
    requiresManagerApproval: false,
    maxActiveReservationsPerResident: 2,
    cancellationLeadTimeHours: 2,
  })
  const [facilityFormError, setFacilityFormError] = useState<string | null>(null)
  const [isSavingFacility, setIsSavingFacility] = useState(false)

  // Maintenance Block Form / Selected Facility
  const [selectedBlockFacilityId, setSelectedBlockFacilityId] = useState<number | null>(null)
  const [isBlockFormOpen, setIsBlockFormOpen] = useState(false)
  const [blockFormData, setBlockFormData] = useState<CreateMaintenanceBlockPayload>({
    startTime: '',
    endTime: '',
    reason: '',
  })
  const [blockFormError, setBlockFormError] = useState<string | null>(null)
  const [isSavingBlock, setIsSavingBlock] = useState(false)

  // Facility Status Toggle Confirmation
  const [deactivatingFacility, setDeactivatingFacility] = useState<CommonFacility | null>(null)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  // Reservation Review Dialog
  const [approvingReservation, setApprovingReservation] = useState<FacilityReservation | null>(null)
  const [rejectingReservation, setRejectingReservation] = useState<FacilityReservation | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)

  const isFacilityDirty = isFacilityDrawerOpen &&
    JSON.stringify(facilityFormData) !== JSON.stringify(facilityFormBaseline)
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isFacilityDirty)

  const facilityDrawerAnimation = useAnimatedDrawer(isFacilityDrawerOpen)

  const closeFacilityDrawerState = () => {
    setIsFacilityDrawerOpen(false)
    setEditingFacility(null)
    setFacilityFormError(null)
  }

  const closeFacilityDrawer = async () => {
    if (!(await requestDiscard())) return
    setIsFacilityDrawerOpen(false)
    setEditingFacility(null)
    setFacilityFormError(null)
  }

  const facilityDrawerRef = useDrawerAccessibility({
    isOpen: facilityDrawerAnimation.shouldRender && !facilityDrawerAnimation.isClosing,
    onClose: () => { void closeFacilityDrawer() },
    isSaving: isSavingFacility,
  })

  // Toast Auto-dismiss
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [facList, propList, bldgList, resList] = await Promise.all([
        getFacilities(),
        getProperties(),
        getBuildings(),
        getManagementFacilityReservations(),
      ])
      setFacilities(facList)
      setProperties(propList)
      setBuildings(bldgList)
      setReservations(resList)

      if (facList.length > 0 && !selectedBlockFacilityId) {
        setSelectedBlockFacilityId(facList[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veriler yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedBlockFacilityId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Load Maintenance Blocks when facility selected
  const loadBlocks = useCallback(async (facilityId: number) => {
    try {
      const blocks = await getMaintenanceBlocks(facilityId)
      setMaintenanceBlocks(blocks)
    } catch {
      setMaintenanceBlocks([])
    }
  }, [])

  useEffect(() => {
    if (selectedBlockFacilityId) {
      void loadBlocks(selectedBlockFacilityId)
    }
  }, [selectedBlockFacilityId, loadBlocks])

  // Realtime Listeners
  useEffect(() => {
    if (!realtime) return

    const unsubRes = realtime.onFacilityReservationUpdated(() => {
      void getManagementFacilityReservations().then(setReservations)
    })

    const unsubAvail = realtime.onFacilityAvailabilityInvalidated(() => {
      void getFacilities().then(setFacilities)
      if (selectedBlockFacilityId) {
        void loadBlocks(selectedBlockFacilityId)
      }
    })

    return () => {
      unsubRes()
      unsubAvail()
    }
  }, [realtime, selectedBlockFacilityId, loadBlocks])

  // Facility Actions
  const handleOpenNewFacility = () => {
    setEditingFacility(null)
    const initialForm: CreateCommonFacilityPayload = {
      propertyId: properties.length > 0 ? properties[0].id : 0,
      buildingId: null,
      name: '',
      description: '',
      locationHint: '',
      capacity: 10,
      openingTime: '08:00',
      closingTime: '22:00',
      slotDurationMinutes: 60,
      requiresManagerApproval: false,
      maxActiveReservationsPerResident: 2,
      cancellationLeadTimeHours: 2,
    }
    setFacilityFormData(initialForm)
    setFacilityFormBaseline(initialForm)
    setFacilityFormError(null)
    setIsFacilityDrawerOpen(true)
  }

  const handleOpenEditFacility = (facility: CommonFacility) => {
    setEditingFacility(facility)
    const editForm: CreateCommonFacilityPayload = {
      propertyId: facility.propertyId,
      buildingId: facility.buildingId,
      name: facility.name,
      description: facility.description || '',
      locationHint: facility.locationHint || '',
      capacity: facility.capacity,
      openingTime: facility.openingTime,
      closingTime: facility.closingTime,
      slotDurationMinutes: facility.slotDurationMinutes,
      requiresManagerApproval: facility.requiresManagerApproval,
      maxActiveReservationsPerResident: facility.maxActiveReservationsPerResident,
      cancellationLeadTimeHours: facility.cancellationLeadTimeHours,
    }
    setFacilityFormData(editForm)
    setFacilityFormBaseline(editForm)
    setFacilityFormError(null)
    setIsFacilityDrawerOpen(true)
  }

  const handleSaveFacility = async (e: React.FormEvent) => {
    e.preventDefault()
    setFacilityFormError(null)

    if (!facilityFormData.name.trim()) {
      setFacilityFormError('Tesis adı zorunludur.')
      return
    }
    if (facilityFormData.propertyId <= 0) {
      setFacilityFormError('Site / Yapı seçimi zorunludur.')
      return
    }

    setIsSavingFacility(true)
    try {
      if (editingFacility) {
        const payload: UpdateCommonFacilityPayload = {
          name: facilityFormData.name,
          description: facilityFormData.description || undefined,
          locationHint: facilityFormData.locationHint || undefined,
          capacity: facilityFormData.capacity,
          openingTime: facilityFormData.openingTime,
          closingTime: facilityFormData.closingTime,
          slotDurationMinutes: facilityFormData.slotDurationMinutes,
          requiresManagerApproval: facilityFormData.requiresManagerApproval,
          maxActiveReservationsPerResident: facilityFormData.maxActiveReservationsPerResident,
          cancellationLeadTimeHours: facilityFormData.cancellationLeadTimeHours,
        }
        await updateFacility(editingFacility.id, payload)
        setToastMessage('Tesis başarıyla güncellendi.')
      } else {
        await createFacility(facilityFormData)
        setToastMessage('Yeni tesis başarıyla oluşturuldu.')
      }

      closeFacilityDrawerState()
      setFacilities(await getFacilities())
    } catch (err) {
      setFacilityFormError(err instanceof Error ? err.message : 'Tesis kaydedilemedi.')
    } finally {
      setIsSavingFacility(false)
    }
  }

  const handleToggleFacilityStatus = async (facility: CommonFacility) => {
    if (facility.isActive) {
      setDeactivatingFacility(facility)
      return
    }

    setIsTogglingStatus(true)
    try {
      await setFacilityStatus(facility.id, true)
      setToastMessage(`${facility.name} tesisi aktifleştirildi.`)
      setFacilities(await getFacilities())
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Durum değiştirilemedi.')
    } finally {
      setIsTogglingStatus(false)
    }
  }

  const handleConfirmDeactivateFacility = async () => {
    if (!deactivatingFacility) return
    setIsTogglingStatus(true)
    try {
      await setFacilityStatus(deactivatingFacility.id, false)
      setToastMessage(`${deactivatingFacility.name} tesisi pasife alındı.`)
      setFacilities(await getFacilities())
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Tesis pasife alınamadı.')
    } finally {
      setIsTogglingStatus(false)
      setDeactivatingFacility(null)
    }
  }

  // Reservation Actions
  const handleApprove = async () => {
    if (!approvingReservation) return
    setIsReviewing(true)
    try {
      await approveFacilityReservation(approvingReservation.id)
      setToastMessage('Rezervasyon onaylandı.')
      setReservations(await getManagementFacilityReservations())
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Rezervasyon onaylanamadı.')
    } finally {
      setIsReviewing(false)
      setApprovingReservation(null)
    }
  }

  const handleReject = async () => {
    if (!rejectingReservation) return
    setIsReviewing(true)
    try {
      await rejectFacilityReservation(rejectingReservation.id, {
        rejectionReason: rejectionReason.trim() || undefined,
      })
      setToastMessage('Rezervasyon reddedildi.')
      setReservations(await getManagementFacilityReservations())
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Rezervasyon reddedilemedi.')
    } finally {
      setIsReviewing(false)
      setRejectingReservation(null)
      setRejectionReason('')
    }
  }

  // Maintenance Block Actions
  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBlockFacilityId) return

    setBlockFormError(null)
    if (!blockFormData.startTime || !blockFormData.endTime || !blockFormData.reason.trim()) {
      setBlockFormError('Tüm alanların doldurulması zorunludur.')
      return
    }

    setIsSavingBlock(true)
    try {
      await createMaintenanceBlock(selectedBlockFacilityId, blockFormData)
      setToastMessage('Bakım bloğu oluşturuldu.')
      setIsBlockFormOpen(false)
      setBlockFormData({ startTime: '', endTime: '', reason: '' })
      await loadBlocks(selectedBlockFacilityId)
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Bakım bloğu eklenemedi.'
      if (err.status === 409 || msg.includes('onaylanmış')) {
        setBlockFormError('Bu zaman aralığında onaylı bir rezervasyon bulunduğu için bakım bloğu oluşturulamıyor.')
      } else {
        setBlockFormError(msg)
      }
    } finally {
      setIsSavingBlock(false)
    }
  }

  const handleDeleteBlock = async (blockId: number) => {
    try {
      await deleteMaintenanceBlock(blockId)
      setToastMessage('Bakım bloğu silindi.')
      if (selectedBlockFacilityId) {
        await loadBlocks(selectedBlockFacilityId)
      }
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Bakım bloğu silinemedi.')
    }
  }

  // Filtered Building Options for Facility Form
  const availableBuildingsForProperty = useMemo(() => {
    if (!facilityFormData.propertyId) return []
    return buildings.filter((b) => b.propertyId === facilityFormData.propertyId)
  }, [buildings, facilityFormData.propertyId])

  // Filtered Building Options for Facility Filter Toolbar
  const availableBuildingsForFilter = useMemo(() => {
    if (facilityPropFilter === 'all') return buildings
    return buildings.filter((b) => b.propertyId === facilityPropFilter)
  }, [buildings, facilityPropFilter])

  // Filtered Facilities List
  const filteredFacilities = useMemo(() => {
    const query = facilitySearch.trim().toLocaleLowerCase('tr-TR')
    return facilities.filter((f) => {
      const matchesSearch = !query ||
        f.name.toLocaleLowerCase('tr-TR').includes(query) ||
        (f.description && f.description.toLocaleLowerCase('tr-TR').includes(query))
      const matchesProp = facilityPropFilter === 'all' || f.propertyId === facilityPropFilter
      const matchesBldg = facilityBldgFilter === 'all' || f.buildingId === facilityBldgFilter
      const matchesStatus = facilityStatusFilter === 'all' || (facilityStatusFilter === 'active' ? f.isActive : !f.isActive)
      return matchesSearch && matchesProp && matchesBldg && matchesStatus
    })
  }, [facilities, facilitySearch, facilityPropFilter, facilityBldgFilter, facilityStatusFilter])

  const activeFacilityFilterCount = [
    facilitySearch.trim() !== '',
    facilityPropFilter !== 'all',
    facilityBldgFilter !== 'all',
    facilityStatusFilter !== 'all',
  ].filter(Boolean).length

  const clearFacilityFilters = () => {
    setFacilitySearch('')
    setFacilityPropFilter('all')
    setFacilityBldgFilter('all')
    setFacilityStatusFilter('all')
  }


  // Filtered Reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
      if (facilityFilter !== 'ALL' && r.facilityId !== facilityFilter) return false
      return true
    })
  }, [reservations, statusFilter, facilityFilter])

  const activeResFilterCount = [
    statusFilter !== 'ALL',
    facilityFilter !== 'ALL',
  ].filter(Boolean).length

  const clearResFilters = () => {
    setStatusFilter('ALL')
    setFacilityFilter('ALL')
  }

  const pendingCount = useMemo(() => reservations.filter((r) => r.status === 'PENDING').length, [reservations])

  return (
    <section className="central-user-view entity-management-view" aria-busy={isLoading}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast toast-success" role="alert" aria-live="polite">
          {toastMessage}
        </div>
      )}

      {/* Tab Navigation Strip */}
      <div className="panel facility-tab-strip">
        <button
          type="button"
          className={`facility-tab-link ${activeTab === 'facilities' ? 'active' : ''}`}
          onClick={() => setActiveTab('facilities')}
        >
          Tesisler <span className="tab-count-badge">{facilities.length}</span>
        </button>
        <button
          type="button"
          className={`facility-tab-link ${activeTab === 'reservations' ? 'active' : ''}`}
          onClick={() => setActiveTab('reservations')}
        >
          Rezervasyonlar{' '}
          <span className={`tab-count-badge ${pendingCount > 0 ? 'badge-danger' : ''}`}>
            {reservations.length}
          </span>
        </button>
        <button
          type="button"
          className={`facility-tab-link ${activeTab === 'maintenance' ? 'active' : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          Bakım Blokları <span className="tab-count-badge">{maintenanceBlocks.length}</span>
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : error ? (
        <section className="panel entity-state-panel error-state">
          <p className="status-message error-message">{error}</p>
          <button type="button" className="secondary-button" onClick={() => void loadData()}>
            Tekrar Dene
          </button>
        </section>
      ) : activeTab === 'facilities' ? (
        /* TAB 1: TESİSLER */
        <>
          <div className="entity-page-actions mb-3">
            <p>{filteredFacilities.length} tesis gösteriliyor.</p>
            <button className="primary-button" type="button" onClick={handleOpenNewFacility}>
              Yeni Tesis
            </button>
          </div>

          <section className="panel entity-toolbar facility-toolbar-5col" aria-label="Tesis filtreleri">
            <div className="form-field">
              <label htmlFor="facility-search">Tesis Ara</label>
              <input
                id="facility-search"
                value={facilitySearch}
                onChange={(e) => setFacilitySearch(e.target.value)}
                placeholder="Tesis adı veya açıklama"
              />
            </div>

            <div className="form-field">
              <label htmlFor="facility-prop-filter">Yapı / Site</label>
              <select
                id="facility-prop-filter"
                value={facilityPropFilter}
                onChange={(e) => {
                  setFacilityPropFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  setFacilityBldgFilter('all')
                }}
              >
                <option value="all">Tüm Siteler</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="facility-bldg-filter">Blok / Bina</label>
              <select
                id="facility-bldg-filter"
                value={facilityBldgFilter}
                onChange={(e) => setFacilityBldgFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">Tüm Bloklar</option>
                {availableBuildingsForFilter.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="facility-status-filter">Durum</label>
              <select
                id="facility-status-filter"
                value={facilityStatusFilter}
                onChange={(e) => setFacilityStatusFilter(e.target.value as any)}
              >
                <option value="all">Tüm Durumlar</option>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>

            <button
              className={`secondary-button entity-filter-clear ${activeFacilityFilterCount > 0 ? 'has-active-filters' : ''}`}
              type="button"
              disabled={activeFacilityFilterCount === 0}
              onClick={clearFacilityFilters}
            >
              <span>Filtreleri Temizle</span>
              {activeFacilityFilterCount > 0 && (
                <span className="filter-count-badge">{activeFacilityFilterCount}</span>
              )}
            </button>
          </section>

          {facilities.length === 0 ? (
            <section className="panel entity-state-panel actionable-empty-state">
              <h2>Henüz ortak alan tesisi bulunmuyor</h2>
              <p>Sistemde tanımlı bir sosyal tesis kaydı bulunmamaktadır.</p>
              <button className="primary-button" type="button" onClick={handleOpenNewFacility}>
                Yeni Tesis
              </button>
            </section>
          ) : filteredFacilities.length === 0 ? (
            <section className="panel entity-state-panel actionable-empty-state">
              <h2>Filtrelere uygun tesis bulunamadı</h2>
              <p>Arama ölçütlerini değiştirin veya filtreleri temizleyin.</p>
              <button className="secondary-button" type="button" onClick={clearFacilityFilters}>
                Filtreleri Temizle
              </button>
            </section>
          ) : (
            <section className="panel entity-table-panel">
              <div className="responsive-table-wrapper">
                <table className="management-table sticky-columns-table">
                  <thead>
                    <tr>
                      <th>Tesis Adı</th>
                      <th>Yapı</th>
                      <th>Blok / Bina</th>
                      <th>Çalışma Saatleri</th>
                      <th>Süre</th>
                      <th>Kapasite</th>
                      <th>Onay</th>
                      <th>Durum</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFacilities.map((f) => (
                      <tr key={f.id} className={!f.isActive ? 'opacity-60' : ''}>
                        <td>
                          <div className="facility-name-cell" title={f.name}>
                            {f.name}
                          </div>
                        </td>
                        <td>{f.propertyName}</td>
                        <td>{f.buildingName || 'Tüm Site Ortak Alanı'}</td>
                        <td>{f.openingTime} – {f.closingTime}</td>
                        <td>{f.slotDurationMinutes} dk</td>
                        <td>{f.capacity} kişi</td>
                        <td>
                          {f.requiresManagerApproval ? (
                            <span className="status-badge warning">Yönetici Onayı</span>
                          ) : (
                            <span className="status-badge success">Otomatik</span>
                          )}
                        </td>
                        <td>
                          {f.isActive ? (
                            <span className="status-badge success">Aktif</span>
                          ) : (
                            <span className="status-badge secondary">Pasif</span>
                          )}
                        </td>
                        <td>
                          <RowActionsMenu
                            label={`${f.name} tesisi işlemleri`}
                            primaryAction={{
                              label: 'Düzenle',
                              onSelect: () => handleOpenEditFacility(f),
                            }}
                            secondaryActions={[
                              {
                                label: f.isActive ? 'Pasife Al' : 'Aktifleştir',
                                danger: f.isActive,
                                onSelect: () => void handleToggleFacilityStatus(f),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : activeTab === 'reservations' ? (
        /* TAB 2: REZERVASYONLAR */
        <>
          <div className="entity-page-actions mb-3">
            <p>{filteredReservations.length} rezervasyon gösteriliyor.</p>
          </div>

          <section className="panel entity-toolbar facility-toolbar-3col" aria-label="Rezervasyon filtreleri">
            <div className="form-field">
              <label htmlFor="res-facility-filter">Tesis</label>
              <select
                id="res-facility-filter"
                value={facilityFilter}
                onChange={(e) => setFacilityFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              >
                <option value="ALL">Tüm Tesisler</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="res-status-filter">Durum</label>
              <select
                id="res-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tüm Durumlar</option>
                <option value="PENDING">Onay Bekleyenler</option>
                <option value="APPROVED">Onaylananlar</option>
                <option value="REJECTED">Reddedilenler</option>
                <option value="CANCELLED">İptal Edilenler</option>
              </select>
            </div>

            <button
              className={`secondary-button entity-filter-clear ${activeResFilterCount > 0 ? 'has-active-filters' : ''}`}
              type="button"
              disabled={activeResFilterCount === 0}
              onClick={clearResFilters}
            >
              <span>Filtreleri Temizle</span>
              {activeResFilterCount > 0 && (
                <span className="filter-count-badge">{activeResFilterCount}</span>
              )}
            </button>
          </section>

          {reservations.length === 0 ? (
            <section className="panel entity-state-panel actionable-empty-state">
              <h2>Henüz rezervasyon bulunmuyor</h2>
              <p>Sistemde herhangi bir tesis için oluşturulmuş rezervasyon kaydı bulunmamaktadır.</p>
            </section>
          ) : filteredReservations.length === 0 ? (
            <section className="panel entity-state-panel actionable-empty-state">
              <h2>Filtrelere uygun rezervasyon bulunamadı</h2>
              <p>Arama ölçütlerini değiştirin veya filtreleri temizleyin.</p>
              <button className="secondary-button" type="button" onClick={clearResFilters}>
                Filtreleri Temizle
              </button>
            </section>
          ) : (
            <section className="panel entity-table-panel">
              <div className="responsive-table-wrapper">
                <table className="management-table sticky-columns-table">
                  <thead>
                    <tr>
                      <th>Sakin</th>
                      <th>Tesis</th>
                      <th>Yapı / Blok</th>
                      <th>Tarih</th>
                      <th>Saat</th>
                      <th>Durum</th>
                      <th>Oluşturulma</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReservations.map((r) => {
                      const badge = STATUS_BADGE_MAP[r.status] || { label: r.status, className: 'status-badge secondary' }
                      return (
                        <tr key={r.id}>
                          <td className="font-semibold">{r.residentName}</td>
                          <td>
                            <div className="facility-name-cell" title={r.facilityName}>
                              {r.facilityName}
                            </div>
                          </td>
                          <td>{r.buildingName ? `${r.buildingName} / D:${r.unitNumber}` : `D:${r.unitNumber}`}</td>
                          <td>{formatDateTime(r.startTime)}</td>
                          <td>
                            {new Date(r.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} –{' '}
                            {new Date(r.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td>
                            <span className={badge.className}>{badge.label}</span>
                          </td>
                          <td className="text-xs text-muted">{formatDateTime(r.createdAt)}</td>
                          <td>
                            {r.status === 'PENDING' ? (
                              <RowActionsMenu
                                label="Rezervasyon onay işlemleri"
                                primaryAction={{
                                  label: 'Onayla',
                                  onSelect: () => setApprovingReservation(r),
                                }}
                                secondaryActions={[
                                  {
                                    label: 'Reddet',
                                    danger: true,
                                    onSelect: () => {
                                      setRejectingReservation(r)
                                      setRejectionReason('')
                                    },
                                  },
                                ]}
                              />
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : (
        /* TAB 3: BAKIM BLOKLARI */
        <>
          <div className="entity-page-actions mb-3">
            <p>{maintenanceBlocks.length} bakım bloğu gösteriliyor.</p>
            {selectedBlockFacilityId && (
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setBlockFormError(null)
                  setIsBlockFormOpen(true)
                }}
              >
                Bakım Bloğu Ekle
              </button>
            )}
          </div>

          <section className="panel entity-toolbar facility-toolbar-3col" aria-label="Bakım bloğu filtreleri">
            <div className="form-field">
              <label htmlFor="block-facility-select">Tesis Seçin</label>
              <select
                id="block-facility-select"
                value={selectedBlockFacilityId || ''}
                onChange={(e) => setSelectedBlockFacilityId(Number(e.target.value))}
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.propertyName})
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Maintenance Block Form Drawer / Modal */}
          {isBlockFormOpen && (
            <div className="form-card bg-card p-4 rounded-lg border border-border mb-4">
              <h3 className="font-bold text-md mb-3">Yeni Bakım Bloğu Oluştur</h3>
              {blockFormError && <div className="alert-box danger mb-3">{blockFormError}</div>}
              <form onSubmit={handleSaveBlock} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Başlangıç Zamanı</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      required
                      value={blockFormData.startTime}
                      onChange={(e) => setBlockFormData({ ...blockFormData, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Bitiş Zamanı</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      required
                      value={blockFormData.endTime}
                      onChange={(e) => setBlockFormData({ ...blockFormData, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Bakım / Kapatma Gerekçesi</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="Örn: Haftalık Genel Temizlik ve Havuz İlaçlaması"
                    value={blockFormData.reason}
                    onChange={(e) => setBlockFormData({ ...blockFormData, reason: e.target.value })}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button type="button" className="secondary-button" onClick={() => setIsBlockFormOpen(false)}>
                    İptal
                  </button>
                  <button type="submit" className="primary-button" disabled={isSavingBlock}>
                    {isSavingBlock ? 'Kaydediliyor...' : 'Bakım Bloğunu Kaydet'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {maintenanceBlocks.length === 0 ? (
            <section className="panel entity-state-panel actionable-empty-state">
              <h2>Henüz bakım bloğu bulunmuyor</h2>
              <p>Seçilen tesis için tanımlı herhangi bir bakım bloğu kaydı bulunmamaktadır.</p>
              {selectedBlockFacilityId && (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setBlockFormError(null)
                    setIsBlockFormOpen(true)
                  }}
                >
                  Bakım Bloğu Ekle
                </button>
              )}
            </section>
          ) : (
            <section className="panel entity-table-panel">
              <div className="responsive-table-wrapper">
                <table className="management-table sticky-columns-table">
                  <thead>
                    <tr>
                      <th>Tesis</th>
                      <th>Başlangıç</th>
                      <th>Bitiş</th>
                      <th>Sebep</th>
                      <th>Oluşturan</th>
                      <th>Oluşturulma</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceBlocks.map((b) => {
                      const facObj = facilities.find((f) => f.id === selectedBlockFacilityId)
                      return (
                        <tr key={b.id}>
                          <td className="font-semibold">{facObj?.name || 'Tesis'}</td>
                          <td>{formatDateTime(b.startTime)}</td>
                          <td>{formatDateTime(b.endTime)}</td>
                          <td>{b.reason}</td>
                          <td>{b.createdByName}</td>
                          <td className="text-xs text-muted">{formatDateTime(b.createdAt)}</td>
                          <td>
                            <RowActionsMenu
                              label="Bakım bloğu işlemleri"
                              primaryAction={{
                                label: 'Kaldır',
                                danger: true,
                                onSelect: () => void handleDeleteBlock(b.id),
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* FACILITY FORM DRAWER */}
      {(isFacilityDrawerOpen || facilityDrawerAnimation.shouldRender) && (
        <>
          <button
            className={`drawer-backdrop drawer-${facilityDrawerAnimation.phase}`}
            type="button"
            aria-label="Tesis formunu kapat"
            disabled={facilityDrawerAnimation.isClosing}
            onClick={() => { void closeFacilityDrawer() }}
          />
          <aside
            ref={facilityDrawerRef as React.RefObject<HTMLElement>}
            tabIndex={-1}
            className={`management-drawer drawer-${facilityDrawerAnimation.phase}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="facility-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Ortak Alan Yönetimi</p>
                <h2 id="facility-form-title" tabIndex={-1} data-drawer-initial-focus>
                  {editingFacility ? 'Tesisi Düzenle' : 'Yeni Tesis'}
                </h2>
                <p className="drawer-description">
                  Ortak alan tesis bilgilerini, çalışma saatlerini ve kullanım kurallarını düzenleyin.
                </p>
              </div>
              <button
                className="drawer-close-button"
                type="button"
                aria-label="Kapat"
                onClick={() => { void closeFacilityDrawer() }}
              >
                ×
              </button>
            </div>

            {facilityFormError && (
              <p className="status-message error-message" role="alert">
                {facilityFormError}
              </p>
            )}

            <form onSubmit={handleSaveFacility} className="property-form drawer-form">
              {/* SECTION 1: Temel Bilgiler */}
              <h3 className="drawer-section-title form-field-full">1. Temel Bilgiler</h3>

              <div className="form-field form-field-full">
                <label htmlFor="facility-name">Tesis Adı *</label>
                <input
                  id="facility-name"
                  type="text"
                  required
                  placeholder="Örn: Açık Yüzme Havuzu, Sosyal Tesis Fitness Salonu"
                  value={facilityFormData.name}
                  onChange={(e) => setFacilityFormData({ ...facilityFormData, name: e.target.value })}
                />
              </div>

              {!editingFacility ? (
                <>
                  <div className="form-field">
                    <label htmlFor="facility-property">Bağlı Site / Konut Yapısı *</label>
                    <select
                      id="facility-property"
                      required
                      value={facilityFormData.propertyId}
                      onChange={(e) =>
                        setFacilityFormData({
                          ...facilityFormData,
                          propertyId: Number(e.target.value),
                          buildingId: null,
                        })
                      }
                    >
                      <option value={0}>Site / Yapı Seçiniz</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="facility-building">Bağlı Blok (İsteğe Bağlı)</label>
                    <select
                      id="facility-building"
                      value={facilityFormData.buildingId || ''}
                      onChange={(e) =>
                        setFacilityFormData({
                          ...facilityFormData,
                          buildingId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">Tüm Site Ortak Alanı (Kısıtlama yok)</option>
                      {availableBuildingsForProperty.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="form-field form-field-full">
                  <span className="readonly-label">Bağlı Yapı / Blok</span>
                  <strong>{editingFacility.propertyName} {editingFacility.buildingName ? `(${editingFacility.buildingName})` : '(Tüm Site)'}</strong>
                </div>
              )}

              <div className="form-field form-field-full">
                <label htmlFor="facility-location">Konum / Blok Bilgisi</label>
                <input
                  id="facility-location"
                  type="text"
                  placeholder="Örn: Sosyal Tesis Binası 1. Kat, A Blok Yanı"
                  value={facilityFormData.locationHint || ''}
                  onChange={(e) => setFacilityFormData({ ...facilityFormData, locationHint: e.target.value })}
                />
              </div>

              <div className="form-field form-field-full">
                <label htmlFor="facility-desc">Açıklama & Kullanım Kuralları</label>
                <textarea
                  id="facility-desc"
                  rows={3}
                  placeholder="Tesis kullanımı ile ilgili kuralları ve kullanım şartlarını yazabilirsiniz..."
                  value={facilityFormData.description || ''}
                  onChange={(e) => setFacilityFormData({ ...facilityFormData, description: e.target.value })}
                />
              </div>

              {/* SECTION 2: Kullanım & Slot Ayarları */}
              <h3 className="drawer-section-title form-field-full">2. Kullanım & Slot Ayarları</h3>

              <div className="form-field">
                <label htmlFor="facility-open-time">Açılış Saati *</label>
                <input
                  id="facility-open-time"
                  type="time"
                  required
                  value={facilityFormData.openingTime}
                  onChange={(e) => setFacilityFormData({ ...facilityFormData, openingTime: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label htmlFor="facility-close-time">Kapanış Saati *</label>
                <input
                  id="facility-close-time"
                  type="time"
                  required
                  value={facilityFormData.closingTime}
                  onChange={(e) => setFacilityFormData({ ...facilityFormData, closingTime: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label htmlFor="facility-slot-duration">Slot Süresi (Dakika) *</label>
                <input
                  id="facility-slot-duration"
                  type="number"
                  required
                  min={15}
                  max={1440}
                  step={15}
                  value={facilityFormData.slotDurationMinutes}
                  onChange={(e) =>
                    setFacilityFormData({ ...facilityFormData, slotDurationMinutes: Number(e.target.value) })
                  }
                />
                <small className="field-help">Rezervasyon dilim süresi (örn: 60 dk)</small>
              </div>

              <div className="form-field">
                <label htmlFor="facility-capacity">Kapasite (Kişi) *</label>
                <input
                  id="facility-capacity"
                  type="number"
                  required
                  min={1}
                  value={facilityFormData.capacity}
                  onChange={(e) => setFacilityFormData({ ...facilityFormData, capacity: Number(e.target.value) })}
                />
                <small className="field-help">Aynı slotta maksimum kişi sayısı</small>
              </div>

              <div className="form-field">
                <label htmlFor="facility-max-active">Max Aktif Hak *</label>
                <input
                  id="facility-max-active"
                  type="number"
                  required
                  min={1}
                  max={10}
                  value={facilityFormData.maxActiveReservationsPerResident}
                  onChange={(e) =>
                    setFacilityFormData({
                      ...facilityFormData,
                      maxActiveReservationsPerResident: Number(e.target.value),
                    })
                  }
                />
                <small className="field-help">Sakin başı aynı andaki max aktif randevu</small>
              </div>

              <div className="form-field">
                <label htmlFor="facility-cancellation-lead">İptal Bildirim Süresi (Saat) *</label>
                <input
                  id="facility-cancellation-lead"
                  type="number"
                  required
                  min={0}
                  max={168}
                  value={facilityFormData.cancellationLeadTimeHours}
                  onChange={(e) =>
                    setFacilityFormData({
                      ...facilityFormData,
                      cancellationLeadTimeHours: Number(e.target.value),
                    })
                  }
                />
                <small className="field-help">Randevuya kaç saat kala cezasız iptal edilebilir</small>
              </div>

              {/* SECTION 3: Onay Tercihleri */}
              <h3 className="drawer-section-title form-field-full">3. Onay Tercihleri</h3>

              <div className="form-field form-field-full checkbox-field">
                <label htmlFor="facility-requires-approval">
                  <input
                    id="facility-requires-approval"
                    type="checkbox"
                    checked={facilityFormData.requiresManagerApproval}
                    onChange={(e) =>
                      setFacilityFormData({ ...facilityFormData, requiresManagerApproval: e.target.checked })
                    }
                  />
                  <span>Rezervasyonlar yönetici onayı gerektirsin</span>
                </label>
                <small className="field-help text-muted">
                  Kapalıysa uygun saat dilimindeki rezervasyon talepleri otomatik onaylanır.
                </small>
              </div>

              {/* STICKY FOOTER ACTIONS */}
              <div className="drawer-actions form-field-full">
                <SaveShortcutHint />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => { void closeFacilityDrawer() }}
                >
                  İptal
                </button>
                <button type="submit" className="primary-button" disabled={isSavingFacility}>
                  {isSavingFacility ? 'Kaydediliyor...' : editingFacility ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* Approval Confirmation Dialog */}
      {approvingReservation && (
        <ConfirmationDialog
          title="Rezervasyon Onayı"
          message={`${approvingReservation.residentName} sakininin ${approvingReservation.facilityName} tesisi için olan talebini onaylamak istiyor musunuz?`}
          confirmLabel="Onayla"
          isLoading={isReviewing}
          onConfirm={handleApprove}
          onCancel={() => setApprovingReservation(null)}
        />
      )}

      {/* Rejection Dialog */}
      {rejectingReservation && (
        <div className="management-drawer-backdrop drawer-phase-enter" onClick={() => setRejectingReservation(null)}>
          <div className="modal-card max-w-md w-full p-4 bg-card rounded-lg border border-border" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2">Rezervasyon Reddi</h3>
            <p className="text-sm text-muted mb-3">
              {rejectingReservation.residentName} sakininin {rejectingReservation.facilityName} talebini reddetmek üzeresiniz.
            </p>

            <div className="form-group mb-4">
              <label className="form-label">Red Gerekçesi (İsteğe Bağlı)</label>
              <textarea
                className="form-input text-sm"
                rows={3}
                placeholder="Örn: Tesis bu saat diliminde bakım nedeniyle kapalıdır."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" className="secondary-button" onClick={() => setRejectingReservation(null)}>
                İptal
              </button>
              <button type="button" className="danger-button" disabled={isReviewing} onClick={handleReject}>
                {isReviewing ? 'Reddediliyor...' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Facility Confirmation Dialog */}
      {deactivatingFacility && (
        <ConfirmationDialog
          title="Tesisi Pasife Al"
          message={`${deactivatingFacility.name} tesisini pasif duruma getirmek istediğinize emin misiniz? Pasif tesisler için sakinler yeni rezervasyon yapamaz.`}
          confirmLabel="Pasife Al"
          danger
          isLoading={isTogglingStatus}
          onConfirm={handleConfirmDeactivateFacility}
          onCancel={() => setDeactivatingFacility(null)}
        />
      )}

      {unsavedChangesDialog}
    </section>
  )
}
