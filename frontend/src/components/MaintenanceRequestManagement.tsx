import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getMaintenanceRequests,
  getMaintenanceRequest,
  assignMaintenanceRequest,
  updateMaintenanceRequestPriority,
  updateMaintenanceRequestStatus,
  addMaintenanceRequestNote,
  getMaintenanceRequestAttachmentFile,
  getProperties,
  getBuildingsByProperty,
  searchUsers,
} from '../api'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import type {
  Building,
  MaintenanceRequestDetailDto,
  MaintenanceRequestListItemDto,
  Property,
  UserSearchResult,
} from '../types'

const CATEGORY_LABEL_MAP: Record<string, string> = {
  PLUMBING: 'Tesisat',
  ELECTRICAL: 'Elektrik',
  HEATING_COOLING: 'Isıtma / Soğutma',
  ELEVATOR: 'Asansör',
  CLEANING: 'Temizlik',
  SECURITY: 'Güvenlik',
  STRUCTURAL: 'Yapısal',
  OTHER: 'Diğer',
}

const PRIORITY_LABEL_MAP: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Düşük', className: 'status-badge muted' },
  NORMAL: { label: 'Normal', className: 'status-badge secondary' },
  HIGH: { label: 'Yüksek', className: 'status-badge warning' },
  EMERGENCY: { label: 'Acil', className: 'status-badge danger' },
}

const STATUS_LABEL_MAP: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Açık', className: 'status-badge warning' },
  IN_PROGRESS: { label: 'İşlemde', className: 'status-badge info' },
  RESOLVED: { label: 'Çözüldü', className: 'status-badge active' },
  CLOSED: { label: 'Kapandı', className: 'status-badge inactive' },
  CANCELLED: { label: 'İptal Edildi', className: 'status-badge inactive' },
}

const ACTION_TYPE_LABEL_MAP: Record<string, { title: string; color: string }> = {
  CREATED: { title: 'Talep oluşturuldu', color: '#64748b' },
  ASSIGNED: { title: 'Teknik personel atandı', color: '#0284c7' },
  PRIORITY_CHANGED: { title: 'Öncelik güncellendi', color: '#d97706' },
  STATUS_CHANGED: { title: 'Talep durumu değiştirildi', color: '#2563eb' },
  NOTE_ADDED: { title: 'Çalışma notu eklendi', color: '#7c3aed' },
  RESOLVED: { title: 'Talep çözüldü olarak işaretlendi', color: '#16a34a' },
  REOPENED: { title: 'Talep yeniden açıldı', color: '#ea580c' },
  CLOSED: { title: 'Talep kapatıldı', color: '#475569' },
  CANCELLED: { title: 'Talep iptal edildi', color: '#dc2626' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUnitLocation(propertyName?: string, buildingName?: string, unitNumber?: string): string {
  const prop = (propertyName || '').trim()
  const bldg = (buildingName || '').trim()
  const unit = (unitNumber || '').trim()
  const cleanUnit = unit.startsWith('D:') ? unit : `D:${unit}`

  if (!bldg || prop.toLowerCase() === bldg.toLowerCase()) {
    return `${prop} / ${cleanUnit}`
  }
  return `${prop} / ${bldg} / ${cleanUnit}`
}

function getSanitizedUserNote(note: string | null): string | null {
  if (!note) return null
  const trimmed = note.trim()
  if (!trimmed) return null

  // Suppress auto-generated system audit logs (both Turkish & English)
  if (trimmed.startsWith('Durum ') && trimmed.includes('->')) return null
  if (trimmed.startsWith('Status changed')) return null
  if (trimmed.startsWith('Öncelik ') && trimmed.includes('değiştirildi')) return null
  if (trimmed.startsWith('Priority changed')) return null
  if (trimmed.startsWith('Talep ') && trimmed.includes('atandı')) return null
  if (trimmed.startsWith('Assigned to')) return null
  if (trimmed === 'Bakım talebi oluşturuldu.' || trimmed === 'Maintenance request created.') return null

  return trimmed
}

function WrenchIcon({ width = 18, height = 18 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}



function NoteIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function HistoryIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function MaintenanceRequestManagement() {
  const { showToast } = useToast()

  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [techStaffList, setTechStaffList] = useState<UserSearchResult[]>([])

  // Filters
  const [propertyFilter, setPropertyFilter] = useState<number | 'all'>('all')
  const [buildingFilter, setBuildingFilter] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assignedStaffFilter, setAssignedStaffFilter] = useState<number | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const [requests, setRequests] = useState<MaintenanceRequestListItemDto[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const pageSize = 15
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Selection & Drawer state
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequestDetailDto | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  // Action states inside drawer
  const [selectedTechUserId, setSelectedTechUserId] = useState<number>(0)
  const [selectedPriority, setSelectedPriority] = useState<string>('')
  const [workNoteText, setWorkNoteText] = useState<string>('')
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false)

  // Status Action Confirmation
  const [pendingStatusAction, setPendingStatusAction] = useState<{ newStatus: string; label: string; isDestructive?: boolean } | null>(null)
  const [statusActionNote, setStatusActionNote] = useState<string>('')

  // Scroll ref for drawer body
  const drawerBodyRef = useRef<HTMLDivElement | null>(null)

  // Animated Drawer hooks
  const { shouldRender, phase } = useAnimatedDrawer(isDrawerOpen)
  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false)
    setSelectedRequest(null)
    setWorkNoteText('')
    setPendingStatusAction(null)
  }, [])

  const drawerRef = useDrawerAccessibility({
    isOpen: isDrawerOpen,
    onClose: closeDrawer,
  })

  // Reset drawer body scrollTop to 0 upon open
  useEffect(() => {
    if (isDrawerOpen && drawerBodyRef.current) {
      drawerBodyRef.current.scrollTop = 0
    }
  }, [isDrawerOpen, selectedRequest])

  // Load static filter datasets
  useEffect(() => {
    getProperties().then(setProperties).catch(() => {})
    searchUsers({ role: 'TECHNICAL_STAFF' }).then(setTechStaffList).catch(() => setTechStaffList([]))
  }, [])

  // Filter buildings update
  useEffect(() => {
    if (typeof propertyFilter === 'number') {
      getBuildingsByProperty(propertyFilter).then(setBuildings).catch(() => setBuildings([]))
    } else {
      setBuildings([])
      setBuildingFilter('all')
    }
  }, [propertyFilter])

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getMaintenanceRequests({
        propertyId: typeof propertyFilter === 'number' ? propertyFilter : undefined,
        buildingId: typeof buildingFilter === 'number' ? buildingFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        assignedToUserId: typeof assignedStaffFilter === 'number' ? assignedStaffFilter : undefined,
        search: searchQuery ? searchQuery.trim() : undefined,
        page,
        pageSize,
      })
      setRequests(res.items)
      setTotalCount(res.totalCount)
    } catch (err: any) {
      showToast(err.message || 'Talepler yüklenirken hata oluştu.')
    } finally {
      setIsLoading(false)
    }
  }, [propertyFilter, buildingFilter, statusFilter, priorityFilter, categoryFilter, assignedStaffFilter, searchQuery, page, showToast])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Open Detail Drawer
  const handleViewDetail = async (item: MaintenanceRequestListItemDto) => {
    try {
      const full = await getMaintenanceRequest(item.id)
      setSelectedRequest(full)
      setSelectedTechUserId(full.assignedToUserId || 0)
      setSelectedPriority(full.priority)
      setWorkNoteText('')
      setIsDrawerOpen(true)
    } catch (err: any) {
      showToast(err.message || 'Talep detayı yüklenemedi.')
    }
  }

  // Handle Technician Assign
  const handleAssignSubmit = async (techUserId?: number) => {
    const targetId = techUserId ?? selectedTechUserId
    if (!selectedRequest || !targetId) return
    if (targetId === selectedRequest.assignedToUserId) return

    setIsSubmittingAction(true)
    try {
      const updated = await assignMaintenanceRequest(selectedRequest.id, targetId)
      setSelectedRequest(updated)
      setSelectedTechUserId(updated.assignedToUserId || 0)
      showToast('Teknik personel ataması yapıldı.')
      fetchRequests()
    } catch (err: any) {
      showToast(err.message || 'Personel ataması yapılamadı.')
      setSelectedTechUserId(selectedRequest.assignedToUserId || 0)
    } finally {
      setIsSubmittingAction(false)
    }
  }

  // Handle Priority Change
  const handlePriorityChange = async (newPrio: string) => {
    if (!selectedRequest || newPrio === selectedRequest.priority) return

    setIsSubmittingAction(true)
    try {
      const updated = await updateMaintenanceRequestPriority(selectedRequest.id, newPrio)
      setSelectedRequest(updated)
      setSelectedPriority(updated.priority)
      showToast('Talep önceliği güncellendi.')
      fetchRequests()
    } catch (err: any) {
      showToast(err.message || 'Öncelik güncellenemedi.')
    } finally {
      setIsSubmittingAction(false)
    }
  }

  // Handle Work Note Submit
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest || !workNoteText.trim()) return

    setIsSubmittingAction(true)
    try {
      const updated = await addMaintenanceRequestNote(selectedRequest.id, workNoteText.trim())
      setSelectedRequest(updated)
      setWorkNoteText('')
      showToast('Çalışma notu eklendi.')
      fetchRequests()
    } catch (err: any) {
      showToast(err.message || 'Not eklenemedi.')
    } finally {
      setIsSubmittingAction(false)
    }
  }

  // Handle Confirm Status Action
  const handleConfirmStatusAction = async () => {
    if (!selectedRequest || !pendingStatusAction) return

    setIsSubmittingAction(true)
    try {
      const updated = await updateMaintenanceRequestStatus(
        selectedRequest.id,
        pendingStatusAction.newStatus,
        statusActionNote.trim() || undefined
      )
      setSelectedRequest(updated)
      setPendingStatusAction(null)
      setStatusActionNote('')
      showToast(`Talep durumu '${(STATUS_LABEL_MAP[updated.status] || {}).label}' olarak güncellendi.`)
      fetchRequests()
    } catch (err: any) {
      showToast(err.message || 'Durum güncellenemedi.')
    } finally {
      setIsSubmittingAction(false)
    }
  }

  // Handle File Download / Preview
  const handleDownloadAttachment = async (attachmentId: number) => {
    if (!selectedRequest) return
    try {
      const { blob, fileName } = await getMaintenanceRequestAttachmentFile(selectedRequest.id, attachmentId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      showToast(err.message || 'Dosya indirilemedi.')
    }
  }

  return (
    <div className="management-page">
      {/* Compact Operational Intro Strip */}
      <div
        className="entity-action-strip"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          background: 'var(--color-surface)',
          padding: '14px 20px',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--color-surface-secondary)',
              color: 'var(--color-primary)',
            }}
          >
            <WrenchIcon width={20} height={20} />
          </div>
          <div>
            <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--color-text-primary)' }}>
              Talep Operasyonları
            </strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Gelen talepleri teknik personele atayın, önceliklendirin ve çözüm sürecini takip edin.
            </span>
          </div>
        </div>
      </div>

      {/* Standard Entity Toolbar */}
      <section className="panel entity-toolbar request-toolbar" aria-label="Bakım talebi filtreleri">
        <div className="form-field">
          <label htmlFor="req-prop-filter">Site</label>
          <select
            id="req-prop-filter"
            value={propertyFilter}
            onChange={(e) => {
              const val = e.target.value
              setPropertyFilter(val === 'all' ? 'all' : Number(val))
              setPage(1)
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
          <label htmlFor="req-bldg-filter">Blok</label>
          <select
            id="req-bldg-filter"
            value={buildingFilter}
            disabled={propertyFilter === 'all'}
            onChange={(e) => {
              const val = e.target.value
              setBuildingFilter(val === 'all' ? 'all' : Number(val))
              setPage(1)
            }}
          >
            <option value="all">Tüm Bloklar</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="req-status-filter">Durum</label>
          <select
            id="req-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="OPEN">Açık</option>
            <option value="IN_PROGRESS">İşlemde</option>
            <option value="RESOLVED">Çözüldü</option>
            <option value="CLOSED">Kapandı</option>
            <option value="CANCELLED">İptal Edildi</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="req-priority-filter">Öncelik</label>
          <select
            id="req-priority-filter"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tüm Öncelikler</option>
            <option value="LOW">Düşük</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Yüksek</option>
            <option value="EMERGENCY">Acil</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="req-category-filter">Kategori</label>
          <select
            id="req-category-filter"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tüm Kategoriler</option>
            {Object.entries(CATEGORY_LABEL_MAP).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="req-tech-filter">Teknik Personel</label>
          <select
            id="req-tech-filter"
            value={assignedStaffFilter}
            onChange={(e) => {
              const val = e.target.value
              setAssignedStaffFilter(val === 'all' ? 'all' : Number(val))
              setPage(1)
            }}
          >
            <option value="all">Tüm Personeller</option>
            {techStaffList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="req-search">Arama</label>
          <input
            id="req-search"
            type="text"
            placeholder="Talep No / Başlık ara..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </section>

      {/* Requests Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={5} />
      ) : requests.length === 0 ? (
        <section className="panel entity-state-panel actionable-empty-state">
          <h2>Kriterlere uygun bakım talebi bulunamadı</h2>
          <p>Arama veya filtre kriterlerinizi değiştirerek tekrar deneyebilirsiniz.</p>
        </section>
      ) : (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Talep No</th>
                  <th>Başlık</th>
                  <th>Site / Blok / Daire</th>
                  <th>Kategori</th>
                  <th>Öncelik</th>
                  <th>Durum</th>
                  <th>Atanan Personel</th>
                  <th>Tarih</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const prio = PRIORITY_LABEL_MAP[r.priority] || { label: r.priority, className: 'status-badge secondary' }
                  const status = STATUS_LABEL_MAP[r.status] || { label: r.status, className: 'status-badge secondary' }
                  const categoryLabel = CATEGORY_LABEL_MAP[r.category] || r.category

                  return (
                    <tr key={r.id} className="clickable-row" onClick={() => handleViewDetail(r)}>
                      <td>
                        <code
                          style={{
                            background: 'var(--color-neutral-soft)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {r.requestNumber}
                        </code>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.92rem' }}>{r.title}</strong>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>
                        {r.propertyName} / {r.buildingName} / D:{r.unitNumber}
                      </td>
                      <td style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>{categoryLabel}</td>
                      <td>
                        <span className={prio.className}>{prio.label}</span>
                      </td>
                      <td>
                        <span className={status.className}>{status.label}</span>
                      </td>
                      <td style={{ fontSize: '0.88rem' }}>
                        {r.assignedToName ? (
                          <span style={{ color: 'var(--color-text-primary)' }}>{r.assignedToName}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Atanmadı</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{formatDate(r.createdAt)}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="button outline small"
                          type="button"
                          onClick={() => handleViewDetail(r)}
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="pagination">
          <button
            className="button outline small"
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Önceki
          </button>
          <span>
            Sayfa {page} / {Math.ceil(totalCount / pageSize)}
          </span>
          <button
            className="button outline small"
            type="button"
            disabled={page >= Math.ceil(totalCount / pageSize)}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki
          </button>
        </div>
      )}

      {/* Detail Drawer - Wider operational layout (~660px) */}
      {shouldRender && selectedRequest && (
        <>
          <button
            className={`drawer-backdrop drawer-${phase}`}
            type="button"
            aria-label="Talep detayını kapat"
            onClick={closeDrawer}
          />
          <aside
            ref={drawerRef as any}
            className={`management-drawer request-drawer drawer-container drawer-${phase}`}
            role="dialog"
            aria-modal="true"
            aria-label="Talep Detayı"
          >
            <div className="drawer-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'var(--color-surface-secondary)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    <WrenchIcon width={14} height={14} />
                  </div>
                  <code style={{ background: 'var(--color-neutral-soft)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>
                    {selectedRequest.requestNumber}
                  </code>
                  <span className={(STATUS_LABEL_MAP[selectedRequest.status] || {}).className || 'status-badge secondary'}>
                    {(STATUS_LABEL_MAP[selectedRequest.status] || {}).label || selectedRequest.status}
                  </span>
                  <span className={(PRIORITY_LABEL_MAP[selectedRequest.priority] || {}).className || 'status-badge secondary'}>
                    {(PRIORITY_LABEL_MAP[selectedRequest.priority] || {}).label || selectedRequest.priority}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>{selectedRequest.title}</h3>
              </div>
              <button className="drawer-close-button" type="button" onClick={closeDrawer}>
                ✕
              </button>
            </div>

            <div
              className="drawer-body"
              ref={drawerBodyRef}
              style={{
                background: 'var(--color-surface-secondary)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              {/* MAJOR SECTION 1: Talep Bilgileri */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '12px',
                  background: 'var(--color-surface-secondary)',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Site / Blok / Daire</span>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                    {formatUnitLocation(selectedRequest.propertyName, selectedRequest.buildingName, selectedRequest.unitNumber)}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Talebi Açan Sakin</span>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>{selectedRequest.createdByName}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Kategori</span>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>{CATEGORY_LABEL_MAP[selectedRequest.category] || selectedRequest.category}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Oluşturulma Tarihi</span>
                  <span style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatDate(selectedRequest.createdAt)}</span>
                </div>

                {selectedRequest.description && (
                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--color-border)', paddingTop: '10px', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Açıklama</span>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.45', color: 'var(--color-text-primary)', fontSize: '0.86rem' }}>
                      {selectedRequest.description}
                    </p>
                  </div>
                )}

                {/* Embedded Attachments inside Talep Bilgileri */}
                {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--color-border)', paddingTop: '10px', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>
                      Ekler ({selectedRequest.attachments.length})
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedRequest.attachments.map((att) => (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: 'var(--color-surface)',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                            </svg>
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.84rem', color: 'var(--color-text-primary)' }}>{att.originalFileName}</strong>
                              <small style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
                                {formatFileSize(att.fileSizeBytes)} • {att.uploadedByName}
                              </small>
                            </div>
                          </div>
                          <button
                            className="button outline small"
                            type="button"
                            onClick={() => handleDownloadAttachment(att.id)}
                          >
                            İndir
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* MAJOR SECTION 2: Yönetim İşlemleri */}
              {selectedRequest.status !== 'CLOSED' && selectedRequest.status !== 'CANCELLED' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '12px',
                    background: 'var(--color-primary-soft)',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(99, 102, 241, 0.22)',
                  }}
                >
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="drawer-assign-select" style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }}>
                      Atanan Teknik Personel
                    </label>
                    <select
                      id="drawer-assign-select"
                      value={selectedTechUserId}
                      onChange={(e) => {
                        const id = Number(e.target.value)
                        setSelectedTechUserId(id)
                        handleAssignSubmit(id)
                      }}
                      disabled={isSubmittingAction}
                    >
                      <option value={0}>-- Atanmadı --</option>
                      {techStaffList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="drawer-prio-select" style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }}>
                      Öncelik
                    </label>
                    <select
                      id="drawer-prio-select"
                      value={selectedPriority}
                      onChange={(e) => {
                        const val = e.target.value
                        setSelectedPriority(val)
                        handlePriorityChange(val)
                      }}
                      disabled={isSubmittingAction}
                    >
                      <option value="LOW">Düşük</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">Yüksek</option>
                      <option value="EMERGENCY">Acil</option>
                    </select>
                  </div>
                </div>
              )}

              {/* MAJOR SECTION 3: Çalışma Notu */}
              {selectedRequest.status !== 'CLOSED' && selectedRequest.status !== 'CANCELLED' && (
                <div
                  className="detail-section"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    padding: '18px 20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <NoteIcon width={18} height={18} />
                    <strong style={{ fontSize: '1rem', color: 'var(--color-text-primary)' }}>Çalışma Notu</strong>
                  </div>
                  <form onSubmit={handleAddNote}>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <textarea
                        rows={3}
                        style={{ width: '100%', minHeight: '85px', margin: 0, fontSize: '0.9rem', padding: '10px 12px', borderRadius: '8px' }}
                        placeholder="Teknik ekibe veya takibe özel çalışma notu ekleyin..."
                        value={workNoteText}
                        onChange={(e) => setWorkNoteText(e.target.value)}
                        maxLength={1000}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        Bu not sakin tarafından da görüntülenebilir.
                      </small>
                      <button
                        className="button secondary"
                        type="submit"
                        disabled={isSubmittingAction || !workNoteText.trim()}
                      >
                        Notu Ekle
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* MAJOR SECTION 4: Talep Geçmişi */}
              <div
                className="detail-section"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  padding: '18px 20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <HistoryIcon width={18} height={18} />
                  <strong style={{ fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                    Talep Geçmişi ({selectedRequest.histories.length})
                  </strong>
                </div>
                {selectedRequest.histories.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Geçmiş kaydı yok.</p>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      paddingLeft: '12px',
                      borderLeft: '2px solid var(--color-border)',
                      marginLeft: '4px',
                    }}
                  >
                    {selectedRequest.histories.map((h) => {
                      const eventMeta = ACTION_TYPE_LABEL_MAP[h.actionType] || { title: h.actionType, color: '#64748b' }
                      const userNote = getSanitizedUserNote(h.note)

                      return (
                        <div
                          key={h.id}
                          style={{
                            position: 'relative',
                            paddingLeft: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '12px',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: '-19px',
                              top: '4px',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: eventMeta.color,
                              border: '2px solid var(--color-surface)',
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: '0.86rem', display: 'block', color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                              {eventMeta.title}
                            </strong>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Yapan: {h.changedByName}</div>
                            {userNote && (
                              <div
                                style={{
                                  fontSize: '0.82rem',
                                  marginTop: '6px',
                                  padding: '6px 10px',
                                  background: 'var(--color-surface-secondary)',
                                  borderRadius: '4px',
                                  border: '1px solid var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                {userNote}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                            {formatDate(h.createdAt)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Action Bar Aligned Right */}
            {selectedRequest.status !== 'CLOSED' && selectedRequest.status !== 'CANCELLED' && (
              <div className="drawer-footer">
                {selectedRequest.status === 'OPEN' && (
                  <>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() =>
                        setPendingStatusAction({
                          newStatus: 'IN_PROGRESS',
                          label: 'Talebi İşleme Al',
                        })
                      }
                    >
                      İşleme Al
                    </button>
                    <button
                      className="button danger filled"
                      type="button"
                      onClick={() =>
                        setPendingStatusAction({
                          newStatus: 'CANCELLED',
                          label: 'Talebi İptal Et',
                          isDestructive: true,
                        })
                      }
                    >
                      İptal Et
                    </button>
                  </>
                )}

                {selectedRequest.status === 'IN_PROGRESS' && (
                  <>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() =>
                        setPendingStatusAction({
                          newStatus: 'RESOLVED',
                          label: 'Çözüldü Olarak İşaretle',
                        })
                      }
                    >
                      Çözüldü Olarak İşaretle
                    </button>
                    <button
                      className="button danger filled"
                      type="button"
                      onClick={() =>
                        setPendingStatusAction({
                          newStatus: 'CANCELLED',
                          label: 'Talebi İptal Et',
                          isDestructive: true,
                        })
                      }
                    >
                      İptal Et
                    </button>
                  </>
                )}

                {selectedRequest.status === 'RESOLVED' && (
                  <>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() =>
                        setPendingStatusAction({
                          newStatus: 'CLOSED',
                          label: 'Talebi Kapat',
                        })
                      }
                    >
                      Kapat
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() =>
                        setPendingStatusAction({
                          newStatus: 'IN_PROGRESS',
                          label: 'Talebi Yeniden Aç',
                        })
                      }
                    >
                      Yeniden Aç
                    </button>
                  </>
                )}
              </div>
            )}
          </aside>
        </>
      )}

      {/* Status Action Confirmation Dialog */}
      {pendingStatusAction !== null && (
        <ConfirmationDialog
          title={pendingStatusAction.label}
          message={`Talep durumunu '${
            STATUS_LABEL_MAP[pendingStatusAction.newStatus]?.label || pendingStatusAction.newStatus
          }' olarak değiştirmek üzeresiniz. Onaylıyor musunuz?`}
          confirmLabel="Onayla"
          cancelLabel="Vazgeç"
          danger={pendingStatusAction.isDestructive}
          onConfirm={handleConfirmStatusAction}
          onCancel={() => {
            setPendingStatusAction(null)
            setStatusActionNote('')
          }}
        >
          <div className="form-group dialog-note-input" style={{ marginTop: '12px' }}>
            <label htmlFor="status-action-note">Açıklama Notu (Opsiyonel):</label>
            <input
              id="status-action-note"
              type="text"
              placeholder="İşlem açıklamasını yazabilirsiniz..."
              value={statusActionNote}
              onChange={(e) => setStatusActionNote(e.target.value)}
              maxLength={1000}
            />
          </div>
        </ConfirmationDialog>
      )}
    </div>
  )
}
