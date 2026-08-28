import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  cancelResidentMaintenanceRequest,
  createResidentMaintenanceRequest,
  getResidentMaintenanceRequest,
  getResidentMaintenanceRequestAttachmentFile,
  getResidentMaintenanceRequests,
  resolveActionResidentMaintenanceRequest,
  uploadResidentMaintenanceRequestAttachment,
} from '../api'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { useRealtimeMaintenance } from '../realtime/useRealtimeMaintenance'
import type { MaintenanceRequestUpdatedEvent } from '../realtime/types'
import type { MaintenanceRequestDetailDto, MaintenanceRequestListItemDto } from '../types'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'

const STATUS_LABEL_MAP: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Açık', className: 'status-badge warning' },
  IN_PROGRESS: { label: 'İşlemde', className: 'status-badge info' },
  RESOLVED: { label: 'Çözüldü', className: 'status-badge active' },
  CLOSED: { label: 'Kapandı', className: 'status-badge inactive' },
  CANCELLED: { label: 'İptal Edildi', className: 'status-badge secondary' },
}

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

const TIMELINE_EVENT_TITLE_MAP: Record<string, { title: string; color: string }> = {
  CREATED: { title: 'Talep oluşturuldu', color: '#2563eb' },
  TECH_ASSIGNED: { title: 'Teknik personel atandı', color: '#8b5cf6' },
  IN_PROGRESS: { title: 'Talep işleme alındı', color: '#f59e0b' },
  WORK_NOTE_ADDED: { title: 'Çalışma notu eklendi', color: '#3b82f6' },
  RESOLVED: { title: 'Talep çözüldü', color: '#10b981' },
  REOPENED: { title: 'Talep yeniden açıldı', color: '#f59e0b' },
  CLOSED: { title: 'Talep kapatıldı', color: '#64748b' },
  CANCELLED: { title: 'Talep iptal edildi', color: '#ef4444' },
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

function formatDate(dateString?: string | null): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    return d.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ResidentMaintenanceRequests() {
  const { showToast } = useToast()
  const [requests, setRequests] = useState<MaintenanceRequestListItemDto[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create Drawer State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formCategory, setFormCategory] = useState('PLUMBING')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Detail Drawer State
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequestDetailDto | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isActionSubmitting, setIsActionSubmitting] = useState(false)

  // Confirmation Dialogs
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null)
  const [reopenConfirmId, setReopenConfirmId] = useState<number | null>(null)

  const createBodyRef = useRef<HTMLDivElement>(null)
  const detailBodyRef = useRef<HTMLDivElement>(null)

  const { shouldRender: shouldRenderCreate, phase: createPhase } = useAnimatedDrawer(isCreateOpen)
  const { shouldRender: shouldRenderDetail, phase: detailPhase } = useAnimatedDrawer(isDetailOpen)

  const isCreateDirty = formTitle.trim() !== '' || formDescription.trim() !== '' || selectedFile !== null
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isCreateDirty)

  const closeCreate = useCallback(() => {
    setIsCreateOpen(false)
    setFormTitle('')
    setFormDescription('')
    setSelectedFile(null)
    setFormCategory('PLUMBING')
  }, [])

  const handleCloseCreateWithGuard = useCallback(async () => {
    if (await requestDiscard()) {
      closeCreate()
    }
  }, [closeCreate, requestDiscard])

  const createDrawerRef = useDrawerAccessibility({
    isOpen: isCreateOpen,
    onClose: closeCreate,
    onRequestClose: () => { void handleCloseCreateWithGuard() },
  })

  const detailDrawerRef = useDrawerAccessibility({
    isOpen: isDetailOpen,
    onClose: () => setIsDetailOpen(false),
  })

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getResidentMaintenanceRequests({
        status: statusFilter === 'all' ? undefined : statusFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        page,
        pageSize,
      })
      setRequests(res.items)
      setTotalCount(res.totalCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Talepleriniz yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, categoryFilter, page, pageSize])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  // Real-Time Maintenance Listener & Reconnect Re-sync
  const isDetailOpenRef = useRef<boolean>(false)
  useEffect(() => {
    isDetailOpenRef.current = isDetailOpen
  }, [isDetailOpen])

  const selectedRequestIdRef = useRef<number | null>(null)
  useEffect(() => {
    selectedRequestIdRef.current = selectedRequest?.id || null
  }, [selectedRequest])

  const handleRealtimeUpdate = useCallback(
    (evt: MaintenanceRequestUpdatedEvent) => {
      void loadRequests()
      if (isDetailOpenRef.current && selectedRequestIdRef.current === evt.requestId) {
        getResidentMaintenanceRequest(evt.requestId)
          .then((fresh) => setSelectedRequest(fresh))
          .catch((err) => console.error('Error refreshing resident detail on realtime event:', err))
      }
    },
    [loadRequests]
  )

  useRealtimeMaintenance(handleRealtimeUpdate, () => { void loadRequests() })

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim() || !formDescription.trim()) return

    setIsSubmitting(true)
    try {
      const created = await createResidentMaintenanceRequest({
        category: formCategory,
        title: formTitle.trim(),
        description: formDescription.trim(),
      })

      if (selectedFile) {
        try {
          await uploadResidentMaintenanceRequestAttachment(created.id, selectedFile)
        } catch {
          showToast('Talep oluşturuldu ancak dosya yüklenirken sorun oluştu.')
        }
      }

      showToast('Bakım talebiniz başarıyla oluşturuldu.')
      setIsCreateOpen(false)
      void loadRequests()
    } catch (err: any) {
      showToast(err.message || 'Talep oluşturulamadı.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const [searchParams] = useSearchParams()
  const requestIdParam = searchParams.get('requestId')
  const autoOpenedRef = useRef<string | null>(null)

  const handleOpenDetail = useCallback(async (id: number) => {
    setIsDetailLoading(true)
    setIsDetailOpen(true)
    try {
      const detail = await getResidentMaintenanceRequest(id)
      setSelectedRequest(detail)
    } catch (err: any) {
      showToast(err.message || 'Bu talebe erişim yetkiniz bulunmuyor veya talep bulunamadı.')
      setIsDetailOpen(false)
      setSelectedRequest(null)
    } finally {
      setIsDetailLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (requestIdParam && autoOpenedRef.current !== requestIdParam) {
      autoOpenedRef.current = requestIdParam
      const id = Number(requestIdParam)
      if (!isNaN(id) && id > 0) {
        void handleOpenDetail(id)
      }
    }
  }, [requestIdParam, handleOpenDetail])

  const handleCancelConfirm = async () => {
    if (!cancelConfirmId) return
    setIsActionSubmitting(true)
    try {
      const updated = await cancelResidentMaintenanceRequest(cancelConfirmId)
      if (selectedRequest?.id === cancelConfirmId) {
        setSelectedRequest(updated)
      }
      showToast('Talep iptal edildi.')
      setCancelConfirmId(null)
      void loadRequests()
    } catch (err: any) {
      showToast(err.message || 'Talep iptal edilemedi.')
    } finally {
      setIsActionSubmitting(false)
    }
  }

  const handleReopenConfirm = async () => {
    if (!reopenConfirmId) return
    setIsActionSubmitting(true)
    try {
      const updated = await resolveActionResidentMaintenanceRequest(reopenConfirmId, 'IN_PROGRESS', 'Sakin sorunun devam ettiğini bildirdi.')
      if (selectedRequest?.id === reopenConfirmId) {
        setSelectedRequest(updated)
      }
      showToast('Talep yeniden açıldı ve teknik ekibe iletildi.')
      setReopenConfirmId(null)
      void loadRequests()
    } catch (err: any) {
      showToast(err.message || 'Talep yeniden açılamadı.')
    } finally {
      setIsActionSubmitting(false)
    }
  }

  const handleDownloadAttachment = async (attachmentId: number) => {
    if (!selectedRequest) return
    try {
      const { blob, fileName } = await getResidentMaintenanceRequestAttachmentFile(selectedRequest.id, attachmentId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      showToast(err.message || 'Ek indirilemedi.')
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <section className="resident-view-content" aria-label="Resident Maintenance Requests">
      <header className="resident-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <p className="eyebrow">SAKİN PORTALI</p>
          <h1>Bakım Taleplerim</h1>
          <p>Bakım ve onarım taleplerinizi oluşturun ve sürecini takip edin.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setIsCreateOpen(true)}
          style={{ width: 'auto', flex: '0 0 auto', padding: '10px 18px', whiteSpace: 'nowrap' }}
        >
          Yeni Talep
        </button>
      </header>

      {/* Compact Toolbar */}
      <section className="panel entity-toolbar" style={{ display: 'flex', gap: '14px', alignItems: 'end', justifyContent: 'flex-start', flexWrap: 'wrap', padding: '12px 18px', marginBottom: '16px' }} aria-label="Talep filtreleri">
        <div className="form-field" style={{ margin: 0, flex: '0 0 auto', width: '170px' }}>
          <label htmlFor="res-req-status">Durum</label>
          <select
            id="res-req-status"
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

        <div className="form-field" style={{ margin: 0, flex: '0 0 auto', width: '180px' }}>
          <label htmlFor="res-req-category">Kategori</label>
          <select
            id="res-req-category"
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
      </section>

      {/* List / Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : error ? (
        <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
          <p className="status-message error-message">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void loadRequests()}>
            Tekrar Dene
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="panel entity-state-panel actionable-empty-state" style={{ padding: '32px 24px' }}>
          <h2>Henüz bir bakım talebiniz yok</h2>
          <p>Daireniz veya ortak alanlarla ilgili yaşadığınız sorunlar için yukarıdaki "Yeni Talep" butonunu kullanabilirsiniz.</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="entity-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem' }}>Talep No</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem' }}>Başlık</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem' }}>Kategori</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem' }}>Durum</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem' }}>Atanan Personel</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem' }}>Tarih</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.78rem' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const statusMeta = STATUS_LABEL_MAP[req.status] || { label: req.status, className: 'status-badge secondary' }
                  return (
                    <tr key={req.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <code style={{ background: 'var(--color-neutral-soft)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.84rem' }}>
                          {req.requestNumber}
                        </code>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {req.title}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '0.88rem' }}>
                        {CATEGORY_LABEL_MAP[req.category] || req.category}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span className={statusMeta.className}>{statusMeta.label}</span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '0.86rem' }}>
                        {req.assignedToName || '—'}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--color-text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {formatDate(req.createdAt)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          className="table-detail-button"
                          type="button"
                          onClick={() => handleOpenDetail(req.id)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '14px' }}>
              <button
                className="button outline small"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Önceki
              </button>
              <span style={{ fontSize: '0.86rem', color: 'var(--color-text-secondary)' }}>
                Sayfa {page} / {totalPages}
              </span>
              <button
                className="button outline small"
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Request Drawer */}
      {shouldRenderCreate && (
        <>
          <button
            className={`drawer-backdrop drawer-${createPhase}`}
            type="button"
            aria-label="Yeni talep oluşturmayı kapat"
            onClick={() => void handleCloseCreateWithGuard()}
          />
          <aside
            ref={createDrawerRef as any}
            tabIndex={-1}
            className={`management-drawer drawer-container drawer-${createPhase}`}
            role="dialog"
            aria-modal="true"
            aria-label="Yeni Bakım Talebi"
            style={{ width: 'min(560px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">SAKİN PORTALI</p>
                <h2>Yeni Bakım Talebi</h2>
                <p className="drawer-description">Sorununuzu bildirin, teknik ekibimiz en kısa sürede ilgilensin.</p>
              </div>
              <button className="drawer-close-button" type="button" aria-label="Kapat" onClick={() => void handleCloseCreateWithGuard()}>
                ✕
              </button>
            </div>

            <div className="drawer-body" ref={createBodyRef}>
              <form id="create-resident-request-form" onSubmit={handleCreateSubmit}>
                <div className="form-group">
                  <label htmlFor="res-create-category">Kategori *</label>
                  <select
                    id="res-create-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    required
                  >
                    {Object.entries(CATEGORY_LABEL_MAP).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="res-create-title">Konu / Başlık *</label>
                  <input
                    id="res-create-title"
                    type="text"
                    placeholder="Örn: Banyo bataryası su sızdırıyor"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    maxLength={200}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="res-create-desc">Açıklama *</label>
                  <textarea
                    id="res-create-desc"
                    rows={6}
                    placeholder="Sorununuzu ve varsa uygun zamanlarınızı detaylıca açıklayın..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 650, color: 'var(--color-text-secondary)' }}>
                    Fotoğraf / Ek Dosya (Opsiyonel)
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: '10px',
                      background: 'var(--color-surface)',
                    }}
                  >
                    <input
                      id="res-create-file"
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="res-create-file"
                      className="button outline small"
                      style={{ margin: 0, cursor: 'pointer', flexShrink: 0, padding: '6px 14px' }}
                    >
                      Dosya Seç
                    </label>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {selectedFile ? (
                        <span style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>
                          {selectedFile.name} <small style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({formatFileSize(selectedFile.size)})</small>
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                          Görsel veya doküman seçilmedi
                        </span>
                      )}
                    </div>
                    {selectedFile && (
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-muted)',
                          cursor: 'pointer',
                          fontSize: '1.1rem',
                          padding: '0 4px',
                        }}
                        title="Dosyayı kaldır"
                        onClick={() => setSelectedFile(null)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <small style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                    Desteklenen formatlar: Görsel (JPG, PNG) veya Doküman (PDF, DOCX). Maksimum 10 MB.
                  </small>
                </div>
              </form>
            </div>

            <div className="drawer-footer">
              <button className="secondary-button" type="button" onClick={() => setIsCreateOpen(false)}>
                Vazgeç
              </button>
              <button className="primary-button" type="submit" form="create-resident-request-form" disabled={isSubmitting}>
                {isSubmitting ? 'Oluşturuluyor...' : 'Talep Oluştur'}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Resident Request Detail Drawer */}
      {shouldRenderDetail && selectedRequest && (
        <>
          <button
            className={`drawer-backdrop drawer-${detailPhase}`}
            type="button"
            aria-label="Talep detayını kapat"
            onClick={() => setIsDetailOpen(false)}
          />
          <aside
            ref={detailDrawerRef as any}
            tabIndex={-1}
            className={`management-drawer request-drawer drawer-container drawer-${detailPhase}`}
            role="dialog"
            aria-modal="true"
            aria-label="Talep Detayı"
            style={{ width: 'min(580px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <code style={{ background: 'var(--color-neutral-soft)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>
                    {selectedRequest.requestNumber}
                  </code>
                  <span className={(STATUS_LABEL_MAP[selectedRequest.status] || {}).className}>
                    {(STATUS_LABEL_MAP[selectedRequest.status] || {}).label || selectedRequest.status}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>{selectedRequest.title}</h3>
              </div>
              <button className="drawer-close-button" type="button" aria-label="Kapat" onClick={() => setIsDetailOpen(false)}>
                ✕
              </button>
            </div>

            <div className="drawer-body" ref={detailBodyRef} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {isDetailLoading ? (
                <LoadingSkeleton variant="detail" />
              ) : (
                <>
                  {/* SECTION 1: Talep Bilgileri */}
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
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Kategori</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                        {CATEGORY_LABEL_MAP[selectedRequest.category] || selectedRequest.category}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Oluşturulma Tarihi</span>
                      <span style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {formatDate(selectedRequest.createdAt)}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Atanan Teknik Personel</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                        {selectedRequest.assignedToName || 'Henüz atanmadı'}
                      </strong>
                    </div>

                    {selectedRequest.resolvedAt && (
                      <div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Çözülme Tarihi</span>
                        <span style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                          {formatDate(selectedRequest.resolvedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: Açıklama */}
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Açıklama
                    </span>
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.88rem',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedRequest.description}
                    </div>
                  </div>

                  {/* SECTION 3: Ekler */}
                  {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                    <div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
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
                              background: 'var(--color-surface-secondary)',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.84rem', color: 'var(--color-text-primary)' }}>{att.originalFileName}</strong>
                              <small style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
                                {formatFileSize(att.fileSizeBytes)}
                              </small>
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

                  {/* SECTION 4: Talep Geçmişi */}
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '10px' }}>
                      Talep Geçmişi ({selectedRequest.histories.length})
                    </span>
                    {selectedRequest.histories.length === 0 ? (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.84rem' }}>Geçmiş kaydı yok.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedRequest.histories.map((h) => {
                          const eventMeta = TIMELINE_EVENT_TITLE_MAP[h.actionType] || { title: h.actionType, color: '#64748b' }
                          const userNote = getSanitizedUserNote(h.note)

                          return (
                            <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                              <div
                                style={{
                                  marginTop: '4px',
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: eventMeta.color,
                                  flexShrink: 0,
                                }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ fontSize: '0.84rem', display: 'block', color: 'var(--color-text-primary)' }}>
                                  {eventMeta.title}
                                </strong>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  {formatDate(h.createdAt)}
                                </span>
                                {userNote && (
                                  <div
                                    style={{
                                      fontSize: '0.82rem',
                                      marginTop: '4px',
                                      padding: '6px 10px',
                                      background: 'var(--color-surface-secondary)',
                                      borderRadius: '6px',
                                      border: '1px solid var(--color-border)',
                                      color: 'var(--color-text-primary)',
                                    }}
                                  >
                                    {userNote}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Resident Actions */}
            <div className="drawer-footer" style={{ justifyContent: 'space-between' }}>
              <button className="secondary-button" type="button" onClick={() => setIsDetailOpen(false)}>
                Kapat
              </button>
              {selectedRequest?.status === 'OPEN' && (
                <button
                  className="button danger filled"
                  type="button"
                  disabled={isActionSubmitting}
                  onClick={() => setCancelConfirmId(selectedRequest.id)}
                >
                  Talebi İptal Et
                </button>
              )}
              {selectedRequest?.status === 'RESOLVED' && (
                <button
                  className="button warning outline"
                  type="button"
                  disabled={isActionSubmitting}
                  onClick={() => setReopenConfirmId(selectedRequest.id)}
                >
                  Sorun Devam Ediyor / Yeniden Aç
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Cancel Confirmation */}
      {cancelConfirmId !== null && (
        <ConfirmationDialog
          title="Talebi İptal Et"
          message="Bu bakım talebini iptal etmek istediğinizden emin misiniz?"
          confirmLabel="İptal Et"
          danger
          onConfirm={handleCancelConfirm}
          onCancel={() => setCancelConfirmId(null)}
        />
      )}

      {/* Reopen Confirmation */}
      {reopenConfirmId !== null && (
        <ConfirmationDialog
          title="Talebi Yeniden Aç"
          message="Sorunun devam ettiğini belirterek talebi teknik ekibe yeniden iletmek istiyor musunuz?"
          confirmLabel="Yeniden Aç"
          onConfirm={handleReopenConfirm}
          onCancel={() => setReopenConfirmId(null)}
        />
      )}

      {unsavedChangesDialog}
    </section>
  )
}
