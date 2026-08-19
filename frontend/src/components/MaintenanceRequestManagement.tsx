import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
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

const KANBAN_COLUMNS = [
  { key: 'OPEN', label: 'Açık', color: '#f59e0b', bgSoft: 'rgba(245, 158, 11, 0.06)' },
  { key: 'IN_PROGRESS', label: 'İşlemde', color: '#3b82f6', bgSoft: 'rgba(59, 130, 246, 0.06)' },
  { key: 'RESOLVED', label: 'Çözüldü', color: '#10b981', bgSoft: 'rgba(16, 185, 129, 0.06)' },
  { key: 'CLOSED', label: 'Kapandı', color: '#64748b', bgSoft: 'rgba(100, 116, 139, 0.06)' },
]

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
  CANCELLED: [],
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

function ListIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function KanbanIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="12" y="3" width="5" height="12" rx="1" />
      <rect x="21" y="3" width="5" height="15" rx="1" />
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

export function MaintenanceRequestManagement() {
  const { showToast } = useToast()

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')

  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [techStaffList, setTechStaffList] = useState<UserSearchResult[]>([])

  // Shared Filters
  const [propertyFilter, setPropertyFilter] = useState<number | 'all'>('all')
  const [buildingFilter, setBuildingFilter] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assignedStaffFilter, setAssignedStaffFilter] = useState<number | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Data State
  const [requests, setRequests] = useState<MaintenanceRequestListItemDto[]>([])
  const [kanbanRequests, setKanbanRequests] = useState<MaintenanceRequestListItemDto[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const pageSize = 15
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Drag & Drop State
  const [draggedCardId, setDraggedCardId] = useState<number | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [pendingTransitionId, setPendingTransitionId] = useState<number | null>(null)

  // Selection & Drawer state
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequestDetailDto | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  // Action states inside drawer
  const [selectedTechUserId, setSelectedTechUserId] = useState<number>(0)
  const [selectedPriority, setSelectedPriority] = useState<string>('')
  const [workNoteText, setWorkNoteText] = useState<string>('')
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false)

  // Status Action Confirmation (Drawer)
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

  // Fetch Requests (Supports single page for Table View and multi-page aggregation for Kanban View)
  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      if (viewMode === 'table') {
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
      } else {
        // Kanban Mode: aggregate ALL pages matching active filters (pageSize capped at 100 by backend)
        const params = {
          propertyId: typeof propertyFilter === 'number' ? propertyFilter : undefined,
          buildingId: typeof buildingFilter === 'number' ? buildingFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          assignedToUserId: typeof assignedStaffFilter === 'number' ? assignedStaffFilter : undefined,
          search: searchQuery ? searchQuery.trim() : undefined,
          page: 1,
          pageSize: 100,
        }

        const firstPage = await getMaintenanceRequests(params)
        let allItems = [...firstPage.items]
        const totalCount = firstPage.totalCount
        const totalPages = Math.ceil(totalCount / 100)

        if (totalPages > 1) {
          const pagePromises = []
          for (let p = 2; p <= totalPages; p++) {
            pagePromises.push(getMaintenanceRequests({ ...params, page: p }))
          }
          const restPages = await Promise.all(pagePromises)
          restPages.forEach((res) => {
            allItems.push(...res.items)
          })
        }

        // Deduplicate items by ID
        const uniqueMap = new Map<number, MaintenanceRequestListItemDto>()
        allItems.forEach((item) => uniqueMap.set(item.id, item))
        const finalItems = Array.from(uniqueMap.values())

        setKanbanRequests(finalItems)
        setTotalCount(totalCount)
      }
    } catch (err: any) {
      showToast(err.message || 'Talepler yüklenirken hata oluştu.')
    } finally {
      setIsLoading(false)
    }
  }, [viewMode, propertyFilter, buildingFilter, statusFilter, priorityFilter, categoryFilter, assignedStaffFilter, searchQuery, page, showToast])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const location = useLocation()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const reqId = params.get('requestId')
    if (reqId) {
      const id = Number(reqId)
      if (!isNaN(id) && id > 0) {
        getMaintenanceRequest(id)
          .then((full) => {
            setSelectedRequest(full)
            setSelectedTechUserId(full.assignedToUserId || 0)
            setSelectedPriority(full.priority)
            setWorkNoteText('')
            setIsDrawerOpen(true)
            window.history.replaceState({}, '', window.location.pathname)
          })
          .catch(() => {})
      }
    }
  }, [location.search])

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

  // Handle Confirm Status Action (Drawer)
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

  // Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, card: MaintenanceRequestListItemDto) => {
    if (card.status === 'CLOSED' || card.status === 'CANCELLED') {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', String(card.id))
    e.dataTransfer.effectAllowed = 'move'
    setDraggedCardId(card.id)
  }

  const handleDragOver = (e: React.DragEvent, columnStatus: string) => {
    e.preventDefault()
    if (!draggedCardId) return

    const card = kanbanRequests.find((r) => r.id === draggedCardId)
    if (!card) return

    const allowed = VALID_TRANSITIONS[card.status] || []
    if (allowed.includes(columnStatus)) {
      e.dataTransfer.dropEffect = 'move'
      if (dragOverColumn !== columnStatus) {
        setDragOverColumn(columnStatus)
      }
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    setDragOverColumn(null)

    const cardIdStr = e.dataTransfer.getData('text/plain')
    const cardId = Number(cardIdStr) || draggedCardId
    setDraggedCardId(null)

    if (!cardId) return
    if (pendingTransitionId === cardId) return

    const card = kanbanRequests.find((r) => r.id === cardId)
    if (!card) return

    if (card.status === targetStatus) return

    const allowed = VALID_TRANSITIONS[card.status] || []
    if (!allowed.includes(targetStatus)) {
      showToast('Bu durum geçişine izin verilmiyor.')
      return
    }

    const originalStatus = card.status
    const nowIso = new Date().toISOString()

    // 1. Optimistic UI update
    setKanbanRequests((prev) =>
      prev.map((item) =>
        item.id === cardId ? { ...item, status: targetStatus, updatedAt: nowIso } : item
      )
    )
    setPendingTransitionId(cardId)

    // 2. Call API
    try {
      await updateMaintenanceRequestStatus(cardId, targetStatus)
      const targetLabel = STATUS_LABEL_MAP[targetStatus]?.label || targetStatus
      showToast(`Talep durumu '${targetLabel}' olarak güncellendi.`)
    } catch (err: any) {
      // Rollback on failure
      setKanbanRequests((prev) =>
        prev.map((item) =>
          item.id === cardId ? { ...item, status: originalStatus } : item
        )
      )
      showToast(err.message || 'Durum güncellenirken bir hata oluştu.')
    } finally {
      setPendingTransitionId(null)
    }
  }

  return (
    <div className="management-page">
      {/* Compact Operational Intro Strip with View Mode Toggle */}
      <div
        className="entity-action-strip"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
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

        {/* View Mode Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--color-surface-secondary)',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'table' ? 'var(--color-surface)' : 'transparent',
              color: viewMode === 'table' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <ListIcon width={16} height={16} />
            Liste
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'kanban' ? 'var(--color-surface)' : 'transparent',
              color: viewMode === 'kanban' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <KanbanIcon width={16} height={16} />
            Kanban
          </button>
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
            disabled={viewMode === 'kanban'}
            title={viewMode === 'kanban' ? 'Kanban modunda durumlar kolonlar halinde gösterilmektedir.' : undefined}
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

      {/* Main Content Area: Table View vs. Kanban View */}
      {viewMode === 'table' ? (
        isLoading ? (
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
                              background: 'var(--color-surface-secondary)',
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
                          {formatUnitLocation(r.propertyName, r.buildingName, r.unitNumber)}
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

            {/* Pagination for Table View */}
            {totalCount > pageSize && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  marginTop: '16px',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  Toplam {totalCount} kayıttan {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} arası gösteriliyor
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="button secondary small"
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Önceki
                  </button>
                  <button
                    className="button secondary small"
                    type="button"
                    disabled={page * pageSize >= totalCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            )}
          </section>
        )
      ) : (
        /* KANBAN BOARD VIEW */
        <section className="kanban-board-section" style={{ marginTop: '8px' }}>
          {isLoading ? (
            <LoadingSkeleton variant="table" rows={4} />
          ) : (
            <div
              className="kanban-board-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
                gap: '16px',
                alignItems: 'start',
                overflowX: 'auto',
                paddingBottom: '16px',
              }}
            >
              {KANBAN_COLUMNS.map((col) => {
                const colItems = kanbanRequests.filter((r) => r.status === col.key)
                const isOver = dragOverColumn === col.key

                return (
                  <div
                    key={col.key}
                    className={`kanban-column ${isOver ? 'drag-over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.key)}
                    style={{
                      background: isOver ? col.bgSoft : 'var(--color-surface-secondary)',
                      borderRadius: '12px',
                      border: isOver ? `2px dashed ${col.color}` : '1px solid var(--color-border)',
                      padding: '16px',
                      minHeight: '480px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      transition: 'background 0.2s ease, border-color 0.2s ease',
                    }}
                  >
                    {/* Column Header */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: '10px',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: col.color,
                            display: 'inline-block',
                          }}
                        />
                        <strong className="kanban-column-title" style={{ fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                          {col.label}
                        </strong>
                      </div>
                      <span
                        style={{
                          background: 'var(--color-surface)',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {colItems.length}
                      </span>
                    </div>

                    {/* Column Cards List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                      {colItems.length === 0 ? (
                        <div
                          style={{
                            padding: '24px 12px',
                            textAlign: 'center',
                            color: 'var(--color-text-muted)',
                            fontSize: '0.85rem',
                            border: '1px dashed var(--color-border)',
                            borderRadius: '8px',
                            marginTop: '4px',
                          }}
                        >
                          Bu aşamada talep yok
                        </div>
                      ) : (
                        colItems.map((r) => {
                          const prio = PRIORITY_LABEL_MAP[r.priority] || { label: r.priority, className: 'status-badge secondary' }
                          const categoryLabel = CATEGORY_LABEL_MAP[r.category] || r.category
                          const isDraggable = r.status !== 'CLOSED' && r.status !== 'CANCELLED'
                          const isPending = pendingTransitionId === r.id

                          return (
                            <div
                              key={r.id}
                              draggable={isDraggable}
                              onDragStart={(e) => handleDragStart(e, r)}
                              onClick={() => handleViewDetail(r)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleViewDetail(r)
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              aria-label={`Talep ${r.requestNumber}: ${r.title}`}
                              className="kanban-card"
                              style={{
                                background: 'var(--color-surface)',
                                borderRadius: '8px',
                                border: '1px solid var(--color-border)',
                                padding: '14px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                cursor: isDraggable ? 'grab' : 'pointer',
                                opacity: isPending ? 0.5 : 1,
                                transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                              }}
                            >
                              {/* Card Top: Request Number & Priority */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <code
                                  style={{
                                    background: 'var(--color-surface-secondary)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontFamily: 'monospace',
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-secondary)',
                                  }}
                                >
                                  {r.requestNumber}
                                </code>
                                <span className={prio.className} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                                  {prio.label}
                                </span>
                              </div>

                              {/* Card Title */}
                              <strong
                                style={{
                                  fontSize: '0.9rem',
                                  color: 'var(--color-text-primary)',
                                  lineHeight: 1.3,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {r.title}
                              </strong>

                              {/* Card Location */}
                              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                                📍 {formatUnitLocation(r.propertyName, r.buildingName, r.unitNumber)}
                              </div>

                              {/* Card Category Badge */}
                              <div>
                                <span
                                  style={{
                                    background: 'var(--color-surface-secondary)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.78rem',
                                    color: 'var(--color-text-secondary)',
                                    border: '1px solid var(--color-border)',
                                  }}
                                >
                                  {categoryLabel}
                                </span>
                              </div>

                              {/* Card Footer: Assigned Tech & Date */}
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginTop: '4px',
                                  paddingTop: '8px',
                                  borderTop: '1px solid var(--color-border)',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <span style={{ color: r.assignedToName ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                                  👤 {r.assignedToName || 'Atanmadı'}
                                </span>
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                  {formatDate(r.createdAt)}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Shared Detail Drawer */}
      {shouldRender && selectedRequest !== null && (
        <>
          <button
            className={`drawer-backdrop drawer-${phase}`}
            type="button"
            aria-label="Bakım talebi detayını kapat"
            onClick={closeDrawer}
          />

          <aside
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="req-drawer-title"
            className={`management-drawer request-detail-drawer drawer-${phase}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="drawer-header">
              <div>
                <span className="drawer-eyebrow">BAKIM TALEBİ DETAYI</span>
                <h2 id="req-drawer-title">
                  <code style={{ fontSize: '1.1rem', marginRight: '8px' }}>{selectedRequest.requestNumber}</code>
                </h2>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={closeDrawer}
                aria-label="Kapat"
              >
                &times;
              </button>
            </div>

            {/* Drawer Body */}
            <div className="drawer-body" ref={drawerBodyRef}>
              <section className="drawer-section">
                <h3>Genel Bilgiler</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Başlık</span>
                    <strong className="detail-value">{selectedRequest.title}</strong>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Konum</span>
                    <span className="detail-value">
                      {formatUnitLocation(
                        selectedRequest.propertyName,
                        selectedRequest.buildingName,
                        selectedRequest.unitNumber
                      )}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Kategori</span>
                    <span className="detail-value">
                      {CATEGORY_LABEL_MAP[selectedRequest.category] || selectedRequest.category}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Talep Eden</span>
                    <span className="detail-value">{selectedRequest.createdByName || '-'}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Oluşturulma Tarihi</span>
                    <span className="detail-value">{formatDate(selectedRequest.createdAt)}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Durum</span>
                    <span
                      className={
                        (STATUS_LABEL_MAP[selectedRequest.status] || { className: 'status-badge secondary' }).className
                      }
                    >
                      {(STATUS_LABEL_MAP[selectedRequest.status] || { label: selectedRequest.status }).label}
                    </span>
                  </div>
                </div>

                <div className="detail-item full-width" style={{ marginTop: '12px' }}>
                  <span className="detail-label">Açıklama</span>
                  <p className="detail-description">{selectedRequest.description || '-'}</p>
                </div>
              </section>

              {/* Priority & Staff Assignment Panel */}
              {selectedRequest.status !== 'CLOSED' && selectedRequest.status !== 'CANCELLED' && (
                <section className="drawer-section">
                  <h3>Yönetim İşlemleri</h3>

                  <div className="drawer-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label htmlFor="drawer-prio-select">Öncelik Seviyesi</label>
                      <select
                        id="drawer-prio-select"
                        value={selectedPriority}
                        disabled={isSubmittingAction}
                        onChange={(e) => handlePriorityChange(e.target.value)}
                      >
                        <option value="LOW">Düşük</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">Yüksek</option>
                        <option value="EMERGENCY">Acil</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="drawer-tech-select">Atanan Teknik Personel</label>
                      <select
                        id="drawer-tech-select"
                        value={selectedTechUserId}
                        disabled={isSubmittingAction}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setSelectedTechUserId(val)
                          if (val > 0) {
                            handleAssignSubmit(val)
                          }
                        }}
                      >
                        <option value={0}>Personele Atanmadı</option>
                        {techStaffList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>
              )}

              {/* Attachments Section */}
              {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                <section className="drawer-section">
                  <h3>Ekli Dosyalar ({selectedRequest.attachments.length})</h3>
                  <ul className="attachment-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {selectedRequest.attachments.map((att) => (
                      <li
                        key={att.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: 'var(--color-surface-secondary)',
                          marginBottom: '6px',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div>
                          <strong>{att.originalFileName}</strong>
                          <span style={{ color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                            ({formatFileSize(att.fileSizeBytes)})
                          </span>
                        </div>
                        <button
                          type="button"
                          className="button outline small"
                          onClick={() => handleDownloadAttachment(att.id)}
                        >
                          İndir
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Work Notes Section */}
              <section className="drawer-section">
                <h3>
                  <NoteIcon width={16} height={16} /> Çalışma Notları
                </h3>

                {selectedRequest.status !== 'CLOSED' && selectedRequest.status !== 'CANCELLED' && (
                  <form onSubmit={handleAddNote} style={{ marginBottom: '16px' }}>
                    <div className="form-group">
                      <textarea
                        rows={2}
                        placeholder="Teknik veya yönetimsel çalışma notu ekleyin..."
                        value={workNoteText}
                        onChange={(e) => setWorkNoteText(e.target.value)}
                        disabled={isSubmittingAction}
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button
                        type="submit"
                        className="button primary small"
                        disabled={isSubmittingAction || !workNoteText.trim()}
                      >
                        Not Ekle
                      </button>
                    </div>
                  </form>
                )}

                {/* History & Timeline */}
                <div className="timeline-list">
                  {selectedRequest.histories && selectedRequest.histories.length > 0 ? (
                    selectedRequest.histories.map((h) => {
                      const userNote = getSanitizedUserNote(h.note)
                      const actionInfo = ACTION_TYPE_LABEL_MAP[h.actionType] || {
                        title: h.actionType,
                        color: 'var(--color-text-secondary)',
                      }

                      return (
                        <div
                          key={h.id}
                          className="timeline-item"
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'var(--color-surface-secondary)',
                            marginBottom: '8px',
                            borderLeft: `4px solid ${actionInfo.color}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                            <strong style={{ color: 'var(--color-text-primary)' }}>{actionInfo.title}</strong>
                            <span style={{ color: 'var(--color-text-muted)' }}>{formatDate(h.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            İşlemi Yapan: {h.changedByName || 'Sistem'}
                          </div>
                          {userNote && (
                            <div
                              style={{
                                marginTop: '6px',
                                padding: '6px 10px',
                                background: 'var(--color-surface)',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                color: 'var(--color-text-primary)',
                              }}
                            >
                              "{userNote}"
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Geçmiş kaydı bulunmuyor.</div>
                  )}
                </div>
              </section>
            </div>

            {/* Drawer Footer Actions */}
            {selectedRequest.status !== 'CLOSED' && selectedRequest.status !== 'CANCELLED' && (
              <div className="drawer-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {selectedRequest.status === 'OPEN' && (
                  <>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() =>
                        setPendingStatusAction({
                          newStatus: 'IN_PROGRESS',
                          label: 'İşleme Al',
                        })
                      }
                    >
                      İşleme Al
                    </button>
                    <button
                      className="button secondary"
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
