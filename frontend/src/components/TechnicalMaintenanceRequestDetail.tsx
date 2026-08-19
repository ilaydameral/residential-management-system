import { useCallback, useEffect, useState } from 'react'
import {
  addTechnicalMaintenanceRequestNote,
  getTechnicalMaintenanceRequest,
  getTechnicalMaintenanceRequestAttachmentFile,
  updateTechnicalMaintenanceRequestStatus,
} from '../api'
import { useToast } from '../context/ToastContext'
import type { MaintenanceRequestDetailDto, MaintenanceRequestHistoryDto } from '../types'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'

const STATUS_LABEL_MAP: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Açık', className: 'status-badge info' },
  IN_PROGRESS: { label: 'İşlemde', className: 'status-badge warning' },
  RESOLVED: { label: 'Çözüldü', className: 'status-badge success' },
  CLOSED: { label: 'Kapandı', className: 'status-badge secondary' },
  CANCELLED: { label: 'İptal Edildi', className: 'status-badge danger' },
}

const PRIORITY_LABEL_MAP: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Düşük', className: 'status-badge muted' },
  NORMAL: { label: 'Normal', className: 'status-badge secondary' },
  IMPORTANT: { label: 'Önemli', className: 'status-badge secondary' },
  URGENT: { label: 'Acil', className: 'status-badge secondary' },
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

function getTimelineEventTitle(event: MaintenanceRequestHistoryDto): string {
  switch (event.actionType) {
    case 'CREATED':
      return 'Talep oluşturuldu'
    case 'ASSIGNED':
    case 'TECH_ASSIGNED':
      return 'Teknik personel atandı'
    case 'WORK_NOTE_ADDED':
    case 'NOTE_ADDED':
      return 'Çalışma notu eklendi'
    case 'PRIORITY_CHANGED':
      return 'Öncelik güncellendi'
    case 'REOPENED':
      return 'Talep yeniden açıldı'
    case 'CANCELLED':
      return 'Talep iptal edildi'
    case 'CLOSED':
      return 'Talep kapatıldı'
    case 'RESOLVED':
      return 'Talep çözüldü'
    case 'STATUS_CHANGED':
      if (event.newStatus === 'IN_PROGRESS') return 'Talep işleme alındı'
      if (event.newStatus === 'RESOLVED') return 'Talep çözüldü'
      if (event.newStatus === 'CLOSED') return 'Talep kapatıldı'
      if (event.newStatus === 'CANCELLED') return 'Talep iptal edildi'
      if (event.newStatus === 'OPEN') return 'Talep yeniden açıldı'
      return 'Talep durumu değiştirildi'
    default:
      return 'Talep güncellendi'
  }
}

function getTimelineEventColor(event: MaintenanceRequestHistoryDto): string {
  switch (event.actionType) {
    case 'CREATED':
      return '#2563eb'
    case 'ASSIGNED':
    case 'TECH_ASSIGNED':
      return '#8b5cf6'
    case 'WORK_NOTE_ADDED':
    case 'NOTE_ADDED':
      return '#0284c7'
    case 'PRIORITY_CHANGED':
      return '#d97706'
    case 'REOPENED':
      return '#f59e0b'
    case 'CANCELLED':
      return '#ef4444'
    case 'CLOSED':
      return '#64748b'
    case 'RESOLVED':
      return '#10b981'
    case 'STATUS_CHANGED':
      if (event.newStatus === 'IN_PROGRESS') return '#f59e0b'
      if (event.newStatus === 'RESOLVED') return '#10b981'
      if (event.newStatus === 'CANCELLED') return '#ef4444'
      return '#3b82f6'
    default:
      return '#64748b'
  }
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

function formatUnitLocation(propertyName?: string | null, buildingName?: string | null, unitNumber?: string | null): string {
  const parts: string[] = []
  if (propertyName) parts.push(propertyName)
  if (buildingName) parts.push(buildingName)
  if (unitNumber) parts.push(`Daire: ${unitNumber}`)
  return parts.length > 0 ? parts.join(' / ') : '—'
}

interface TechnicalMaintenanceRequestDetailProps {
  requestId: number
  onBack: () => void
}

export function TechnicalMaintenanceRequestDetail({ requestId, onBack }: TechnicalMaintenanceRequestDetailProps) {
  const { showToast } = useToast()
  const [request, setRequest] = useState<MaintenanceRequestDetailDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [workNoteText, setWorkNoteText] = useState('')
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)
  const [pendingStatusAction, setPendingStatusAction] = useState<{ newStatus: string; label: string } | null>(null)

  const loadDetail = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getTechnicalMaintenanceRequest(requestId)
      setRequest(data)
    } catch (err: any) {
      showToast(err.message || 'Bu talebe erişim yetkiniz bulunmuyor veya talep bulunamadı.')
      onBack()
    } finally {
      setIsLoading(false)
    }
  }, [requestId, showToast, onBack])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!request || !workNoteText.trim()) return

    setIsSubmittingAction(true)
    try {
      const updated = await addTechnicalMaintenanceRequestNote(request.id, workNoteText.trim())
      setRequest(updated)
      setWorkNoteText('')
      showToast('Çalışma notu eklendi.')
    } catch (err: any) {
      showToast(err.message || 'Not eklenemedi.')
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleConfirmStatusAction = async () => {
    if (!request || !pendingStatusAction) return
    const { newStatus } = pendingStatusAction
    setPendingStatusAction(null)
    setIsSubmittingAction(true)
    try {
      const updated = await updateTechnicalMaintenanceRequestStatus(request.id, newStatus)
      setRequest(updated)
      showToast(newStatus === 'IN_PROGRESS' ? 'Talep işleme alındı.' : 'Talep çözüldü olarak işaretlendi.')
    } catch (err: any) {
      showToast(err.message || 'Durum güncellenemedi.')
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleDownloadAttachment = async (attachmentId: number) => {
    if (!request) return
    try {
      const { blob, fileName } = await getTechnicalMaintenanceRequestAttachmentFile(request.id, attachmentId)
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

  if (isLoading) {
    return (
      <div className="management-page">
        <div style={{ marginBottom: '14px' }}>
          <button
            className="button secondary small"
            type="button"
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Atanan Taleplere Dön
          </button>
        </div>
        <LoadingSkeleton variant="detail" rows={6} />
      </div>
    )
  }

  if (!request) {
    return null
  }

  const statusMeta = STATUS_LABEL_MAP[request.status] || { label: request.status, className: 'status-badge secondary' }
  const prioMeta = PRIORITY_LABEL_MAP[request.priority] || { label: request.priority, className: 'status-badge secondary' }
  const locationStr = formatUnitLocation(request.propertyName, request.buildingName, request.unitNumber)

  return (
    <div className="management-page">
      {/* Page Header Area */}
      <div style={{ marginBottom: '24px' }}>
        {/* Back Button */}
        <div style={{ marginBottom: '10px' }}>
          <button
            className="button secondary small"
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Atanan Taleplere Dön
          </button>
        </div>

        {/* Title + Metadata (Left) & Lifecycle Action (Right) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1 1 300px' }}>
            <p className="eyebrow" style={{ margin: 0 }}>TEKNİK PERSONEL PORTALI</p>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '2px 0 8px 0', color: 'var(--color-text-primary)', lineHeight: 1.25 }}>
              {request.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
              <code
                style={{
                  background: 'var(--color-neutral-soft)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {request.requestNumber}
              </code>
              <span className={statusMeta.className}>{statusMeta.label}</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: 'var(--color-surface-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                {prioMeta.label}
              </span>
            </div>
          </div>

          {/* Right: Lifecycle action button (Primary project style) */}
          {request.status !== 'CLOSED' && request.status !== 'CANCELLED' && request.status !== 'RESOLVED' && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
              {request.status === 'OPEN' && (
                <button
                  className="primary-button"
                  type="button"
                  disabled={isSubmittingAction}
                  onClick={() => setPendingStatusAction({ newStatus: 'IN_PROGRESS', label: 'İşleme Al' })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 600, flex: 'none' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                  </svg>
                  İşleme Al
                </button>
              )}

              {request.status === 'IN_PROGRESS' && (
                <button
                  className="primary-button"
                  type="button"
                  disabled={isSubmittingAction}
                  onClick={() => setPendingStatusAction({ newStatus: 'RESOLVED', label: 'Çözüldü Olarak İşaretle' })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 600, flex: 'none' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Çözüldü Olarak İşaretle
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout (Left ~65%, Right ~35%, Gap 20px) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left Column (~64-66%): Talep Bilgileri, Açıklama, Ekler, Çalışma Notu */}
        <div style={{ flex: '2 1 620px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* SECTION 1: Talep Bilgileri */}
          <section className="panel" style={{ padding: '20px 24px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              Talep Bilgileri
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px' }}>Site / Blok / Daire</span>
                <strong style={{ fontSize: '0.92rem', color: 'var(--color-text-primary)' }}>{locationStr}</strong>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px' }}>Talebi Açan Sakin</span>
                <strong style={{ fontSize: '0.92rem', color: 'var(--color-text-primary)' }}>{request.createdByName || '—'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px' }}>Kategori</span>
                <span style={{ fontSize: '0.92rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {CATEGORY_LABEL_MAP[request.category] || request.category}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px' }}>Oluşturma Tarihi</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{formatDate(request.createdAt)}</span>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px' }}>Durum</span>
                <span className={statusMeta.className}>{statusMeta.label}</span>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px' }}>Öncelik</span>
                <span className={prioMeta.className}>{prioMeta.label}</span>
              </div>
            </div>
          </section>

          {/* SECTION 2: Açıklama */}
          <section className="panel" style={{ padding: '20px 24px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              Açıklama
            </h2>
            <p style={{ margin: 0, fontSize: '0.94rem', color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {request.description}
            </p>
          </section>

          {/* SECTION 3: Ekler (Only shown if attachments exist) */}
          {request.attachments && request.attachments.length > 0 && (
            <section className="panel" style={{ padding: '20px 24px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
                Ek Dosyalar ({request.attachments.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {request.attachments.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--color-surface-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '12px' }}>
                      <strong style={{ fontSize: '0.88rem', display: 'block', color: 'var(--color-text-primary)' }}>{att.originalFileName}</strong>
                      <small style={{ color: 'var(--color-text-muted)' }}>
                        {formatFileSize(att.fileSizeBytes)} • Yükleyen: {att.uploadedByName}
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
            </section>
          )}

          {/* SECTION 4: Çalışma Notu */}
          <section className="panel" style={{ padding: '20px 24px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Çalışma Notu Ekle
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
              Bu not sakin tarafından da görüntülenebilir.
            </p>
            <form onSubmit={handleAddNote}>
              <div className="form-field" style={{ marginBottom: '12px' }}>
                <textarea
                  rows={3}
                  placeholder="Sakin ve yönetim tarafından görülebilecek teknik çalışma notunuzu girin..."
                  value={workNoteText}
                  onChange={(e) => setWorkNoteText(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="button primary small"
                  type="submit"
                  disabled={isSubmittingAction || !workNoteText.trim()}
                  style={{
                    opacity: isSubmittingAction || !workNoteText.trim() ? 0.55 : 1,
                    cursor: isSubmittingAction || !workNoteText.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  Notu Ekle
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column (~34-36%): SECTION 5: Talep Geçmişi Timeline */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <section className="panel" style={{ padding: '20px 24px', position: 'sticky', top: '20px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              Talep Geçmişi
            </h2>

            {request.histories && request.histories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                {request.histories.map((event) => {
                  const title = getTimelineEventTitle(event)
                  const color = getTimelineEventColor(event)
                  const userNote = getSanitizedUserNote(event.note)

                  return (
                    <div key={event.id} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: color,
                          flexShrink: 0,
                          marginTop: '5px',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)', display: 'block', lineHeight: 1.3 }}>
                          {title}
                        </strong>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                            {event.changedByName || 'Sistem'}
                          </span>
                          <time style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {formatDate(event.createdAt)}
                          </time>
                        </div>
                        {userNote && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: 'var(--color-surface-secondary)',
                              border: '1px solid var(--color-border-subtle)',
                              fontSize: '0.84rem',
                              color: 'var(--color-text-primary)',
                              lineHeight: 1.45,
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
            ) : (
              <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
                Henüz geçmiş kaydı bulunmuyor.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Confirmation Dialog for Lifecycle Actions */}
      {pendingStatusAction && (
        <ConfirmationDialog
          title={pendingStatusAction.label}
          message={
            pendingStatusAction.newStatus === 'IN_PROGRESS'
              ? 'Talebi işleme almak istediğinizden emin misiniz?'
              : 'Talebi çözüldü olarak işaretlemek istediğinizden emin misiniz?'
          }
          confirmLabel={pendingStatusAction.label}
          onCancel={() => setPendingStatusAction(null)}
          onConfirm={() => void handleConfirmStatusAction()}
        />
      )}
    </div>
  )
}
