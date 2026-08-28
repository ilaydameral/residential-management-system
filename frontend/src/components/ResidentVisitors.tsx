import React, { useState, useEffect, useCallback } from 'react'
import {
  getResidentVisitors,
  createVisitor,
  cancelVisitor,
} from '../api'
import type { Visitor, CreateVisitorPayload, VisitorType } from '../types'
import { ConfirmationDialog } from './ConfirmationDialog'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { useResidentUnits } from '../hooks/useResidentUnits'
import { SaveShortcutHint } from './SaveShortcutHint'
import { LoadingSkeleton } from './LoadingSkeleton'
import { useToast } from '../context/ToastContext'
import { useRealtime } from '../realtime/useRealtime'

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const VISITOR_TYPE_LABELS: Record<VisitorType, string> = {
  GUEST: 'Misafir',
  SERVICE_PROVIDER: 'Hizmet Sağlayıcı',
  DELIVERY: 'Teslimat',
  COMMERCIAL: 'Ticari Ziyaret',
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  EXPECTED: 'warning',
  CHECKED_IN: 'active',
  CHECKED_OUT: 'inactive',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
}

const STATUS_LABELS: Record<string, string> = {
  EXPECTED: 'Bekleniyor',
  CHECKED_IN: 'Giriş Yaptı',
  CHECKED_OUT: 'Çıkış Yaptı',
  CANCELLED: 'İptal Edildi',
  EXPIRED: 'Süresi Doldu',
}

function formatTurkishDateTime(isoString: string): string {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Ekim', 'Kas', 'Ara']
    const day = d.getDate()
    const monthStr = months[d.getMonth()]
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day} ${monthStr} ${year} · ${hours}:${minutes}`
  } catch {
    return isoString
  }
}

interface ResidentVisitorCardProps {
  visitor: Visitor
  copiedCardPinId: number | null
  onCopyPin: (id: number, code: string) => void
  onCancel: (visitor: Visitor) => void
}

export function ResidentVisitorCard({
  visitor,
  copiedCardPinId,
  onCopyPin,
  onCancel,
}: ResidentVisitorCardProps) {
  return (
    <article className="resident-visitor-card">
      {/* CARD HEADER */}
      <div className="resident-visitor-card-header">
        <div>
          <h2 className="resident-visitor-card-title">
            {visitor.visitorName}
          </h2>
          <p className="resident-visitor-card-location">
            Daire {visitor.unitNumber} · {visitor.buildingName} · {visitor.propertyName}
          </p>
        </div>
        <div className="resident-visitor-badges">
          <span className={`status-badge ${STATUS_BADGE_CLASSES[visitor.status] || 'inactive'}`}>
            {STATUS_LABELS[visitor.status] || visitor.status}
          </span>
          <span className="visitor-type-chip">
            {VISITOR_TYPE_LABELS[visitor.visitorType] || visitor.visitorType}
          </span>
        </div>
      </div>

      {/* DETAIL GRID (2-column desktop grid) */}
      <div className="resident-visitor-detail-grid">
        <div className="resident-visitor-detail">
          <span className="resident-visitor-detail-label">Beklenen Giriş</span>
          <span className="resident-visitor-detail-value">
            {formatTurkishDateTime(visitor.expectedArrival)}
          </span>
        </div>

        <div className="resident-visitor-detail">
          <span className="resident-visitor-detail-label">Beklenen Çıkış</span>
          <span className="resident-visitor-detail-value">
            {formatTurkishDateTime(visitor.expectedDeparture)}
          </span>
        </div>

        <div className="resident-visitor-detail">
          <span className="resident-visitor-detail-label">Araç</span>
          {visitor.vehiclePlate ? (
            <div>
              <code className="resident-visitor-plate-code">
                {visitor.vehiclePlate}
              </code>
            </div>
          ) : (
            <span className="resident-visitor-detail-value">—</span>
          )}
        </div>

        <div className="resident-visitor-detail">
          <span className="resident-visitor-detail-label">Telefon</span>
          <span className="resident-visitor-detail-value">
            {visitor.visitorPhone || '—'}
          </span>
        </div>
      </div>

      {/* FOOTER */}
      <div className="resident-visitor-card-footer">
        <div className="resident-visitor-access-code">
          <div className="resident-visitor-access-info">
            <span className="resident-visitor-access-label">Giriş Kodu</span>
            <code className="resident-visitor-access-value">
              {visitor.accessCode.replace(/(\d{3})(\d{3})/, '$1 $2')}
            </code>
          </div>
          <button
            type="button"
            className="resident-visitor-copy-button"
            onClick={() => onCopyPin(visitor.id, visitor.accessCode)}
            title="Giriş kodunu kopyala"
          >
            {copiedCardPinId === visitor.id ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>

        {visitor.status === 'EXPECTED' && (
          <button
            type="button"
            className="action-button danger-btn"
            onClick={() => onCancel(visitor)}
          >
            İptal Et
          </button>
        )}
      </div>
    </article>
  )
}

export function ResidentVisitors() {
  const { groupedUnits, loading: unitsLoading, refetch: refetchUnits } = useResidentUnits()
  const { showToast } = useToast()
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Drawer & Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [createdVisitor, setCreatedVisitor] = useState<Visitor | null>(null)
  const [copiedModalPin, setCopiedModalPin] = useState(false)
  const [copiedCardPinId, setCopiedCardPinId] = useState<number | null>(null)

  // Cancellation State
  const [cancelingVisitor, setCancelingVisitor] = useState<Visitor | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)

  // Form Fields
  const [formData, setFormData] = useState<CreateVisitorPayload>({
    unitId: 0,
    visitorName: '',
    visitorPhone: '',
    visitorType: 'GUEST',
    vehiclePlate: '',
    expectedArrival: '',
    expectedDeparture: '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const isFormDirty = isDrawerOpen && (
    formData.visitorName.trim() !== '' ||
    formData.visitorPhone?.trim() !== '' ||
    formData.vehiclePlate?.trim() !== ''
  )
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isFormDirty)

  const drawerAnimation = useAnimatedDrawer(isDrawerOpen)

  const handleCloseDrawer = async () => {
    if (isSaving) return
    if (!(await requestDiscard())) return
    drawerAnimation.close(() => setIsDrawerOpen(false))
  }

  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.phase !== 'closed',
    onClose: () => { void handleCloseDrawer() },
    isSaving,
  })

  // Sync unitId when groupedUnits finishes loading
  useEffect(() => {
    if (groupedUnits.length > 0 && (!formData.unitId || !groupedUnits.some(u => u.unitId === formData.unitId))) {
      setFormData(prev => ({ ...prev, unitId: groupedUnits[0].unitId }))
    }
  }, [groupedUnits, formData.unitId])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const vList = await getResidentVisitors()
      setVisitors(vList)
      await refetchUnits()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Ziyaretçiler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [refetchUnits])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime SignalR listener
  const realtime = useRealtime()
  useEffect(() => {
    if (!realtime?.onVisitorStatusChanged) return
    const unsubscribe = realtime.onVisitorStatusChanged(() => {
      loadData()
    })
    return () => unsubscribe()
  }, [realtime, loadData])

  const handleOpenDrawer = () => {
    if (groupedUnits.length === 0) {
      showToast('Aktif daire yerleşiminiz bulunmadığı için ziyaretçi kaydı oluşturamazsınız.', 'info')
      return
    }

    const now = new Date()
    const arr = new Date(now.getTime() + 30 * 60 * 1000)
    const dep = new Date(now.getTime() + 4 * 60 * 60 * 1000)

    const defaultUnitId = groupedUnits.length > 0 ? groupedUnits[0].unitId : 0

    const toLocalISO = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    setFormData({
      unitId: defaultUnitId,
      visitorName: '',
      visitorPhone: '',
      visitorType: 'GUEST',
      vehiclePlate: '',
      expectedArrival: toLocalISO(arr),
      expectedDeparture: toLocalISO(dep),
    })
    setFormError(null)
    setIsDrawerOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return

    setFormError(null)

    if (!formData.unitId) {
      setFormError('Lütfen bir daire seçin.')
      return
    }

    if (!formData.visitorName.trim()) {
      setFormError('Lütfen ziyaretçi adını girin.')
      return
    }

    if (!formData.expectedArrival || !formData.expectedDeparture) {
      setFormError('Lütfen beklenen giriş ve çıkış tarihlerini girin.')
      return
    }

    const arr = new Date(formData.expectedArrival)
    const dep = new Date(formData.expectedDeparture)

    if (arr >= dep) {
      setFormError('Beklenen çıkış zamanı, giriş zamanından sonra olmalıdır.')
      return
    }

    try {
      setIsSaving(true)
      const created = await createVisitor({
        ...formData,
        expectedArrival: new Date(formData.expectedArrival).toISOString(),
        expectedDeparture: new Date(formData.expectedDeparture).toISOString(),
      })

      // Immediate success transition
      drawerAnimation.close(() => setIsDrawerOpen(false))
      setCreatedVisitor(created)
      showToast('Ziyaretçi kaydı başarıyla oluşturuldu.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ziyaretçi oluşturulamadı.')
    } finally {
      setIsSaving(false)
    }

    // Refetch data asynchronously without blocking PIN success modal
    try {
      await loadData()
    } catch (err) {
      console.warn('Silent refetch warning after visitor creation:', err)
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancelingVisitor) return
    try {
      setIsCanceling(true)
      await cancelVisitor(cancelingVisitor.id)
      showToast('Ziyaretçi kaydı iptal edildi.')
      setCancelingVisitor(null)
      await loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ziyaretçi iptal edilemedi.', 'error')
    } finally {
      setIsCanceling(false)
    }
  }

  const copyModalAccessCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedModalPin(true)
    showToast('Giriş kodu kopyalandı.', 'info')
    setTimeout(() => setCopiedModalPin(false), 2000)
  }

  const copyCardAccessCode = (id: number, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCardPinId(id)
    showToast('Giriş kodu kopyalandı.', 'info')
    setTimeout(() => setCopiedCardPinId(null), 2000)
  }

  // Filter visitors
  const upcomingVisitors = visitors.filter(
    v => v.status === 'EXPECTED' || v.status === 'CHECKED_IN'
  )
  const pastVisitors = visitors.filter(
    v => v.status === 'CHECKED_OUT' || v.status === 'CANCELLED' || v.status === 'EXPIRED'
  )

  const displayedVisitors = activeTab === 'upcoming' ? upcomingVisitors : pastVisitors

  return (
    <section className="resident-view-content" aria-label="Ziyaretçiler">
      {/* Page Header Row */}
      <div className="page-header-row" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
        <div>
          <p className="eyebrow" style={{ margin: '0 0 4px 0' }}>SAKİN PORTALI</p>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>Ziyaretçiler</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
            Beklediğiniz ziyaretçileri önceden tanımlayın ve giriş durumlarını takip edin.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={handleOpenDrawer}
          style={{ width: 'auto', flex: '0 0 auto', padding: '10px 18px', whiteSpace: 'nowrap' }}
        >
          Yeni Ziyaretçi
        </button>
      </div>

      {/* Segmented Control Tabs (Compact, Left-aligned) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="facility-tab-strip" style={{ width: 'auto', display: 'inline-flex' }}>
          <button
            type="button"
            className={`facility-tab-link ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            <span>Yaklaşan</span>
            <span className="tab-count-badge">{upcomingVisitors.length}</span>
          </button>
          <button
            type="button"
            className={`facility-tab-link ${activeTab === 'past' ? 'active' : ''}`}
            onClick={() => setActiveTab('past')}
          >
            <span>Geçmiş</span>
            <span className="tab-count-badge">{pastVisitors.length}</span>
          </button>
        </div>
      </div>

      {/* Visitor Cards List */}
      {loading || unitsLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : loadError ? (
        <section className="panel entity-state-panel error-state" role="alert">
          <p className="status-message error-message">{loadError}</p>
          <button type="button" className="secondary-button" onClick={() => void loadData()}>Tekrar Dene</button>
        </section>
      ) : displayedVisitors.length === 0 ? (
        <div className="panel entity-state-panel" style={{ padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '8px' }}>
            👤
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {activeTab === 'upcoming'
              ? 'Yaklaşan ziyaretçiniz bulunmuyor.'
              : 'Geçmiş ziyaretçi kaydınız bulunmuyor.'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '400px' }}>
            {activeTab === 'upcoming'
              ? 'Beklediğiniz ziyaretçileri yukarıdaki "Yeni Ziyaretçi" butonu ile sisteme ekleyebilirsiniz.'
              : 'Tamamlanan veya iptal edilen ziyaretçi kayıtlarınız burada arşivlenir.'}
          </p>
        </div>
      ) : (
        <div className="resident-visitor-card-list">
          {displayedVisitors.map(v => (
            <ResidentVisitorCard
              key={v.id}
              visitor={v}
              copiedCardPinId={copiedCardPinId}
              onCopyPin={copyCardAccessCode}
              onCancel={setCancelingVisitor}
            />
          ))}
        </div>
      )}

      {/* Created Access Code Dialog */}
      {createdVisitor && (
        <ConfirmationDialog
          title="Ziyaretçi Kaydı Oluşturuldu"
          message={`${createdVisitor.visitorName} için oluşturulan 6 haneli giriş kodunu ziyaretçiniz ile paylaşabilirsiniz.`}
          confirmLabel="Tamam"
          showCancel={false}
          onConfirm={() => setCreatedVisitor(null)}
          onCancel={() => setCreatedVisitor(null)}
        >
          <div className="access-code-dialog-content">
            <span>Giriş Kodu (PIN)</span>
            <strong>{createdVisitor.accessCode.replace(/(\d{3})(\d{3})/, '$1 $2')}</strong>
            <button
              type="button"
              className="secondary-button"
              onClick={() => copyModalAccessCode(createdVisitor.accessCode)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.stopPropagation()
              }}
            >
              {copiedModalPin ? <CheckIcon /> : <CopyIcon />}
              <span>{copiedModalPin ? 'Kopyalandı!' : 'Kodu Kopyala'}</span>
            </button>
          </div>
        </ConfirmationDialog>
      )}

      {/* Cancel Confirmation Dialog */}
      {cancelingVisitor && (
        <ConfirmationDialog
          title="Ziyaretçi İptali"
          message={`${cancelingVisitor.visitorName} isimli ziyaretçi kaydını iptal etmek istediğinize emin misiniz?`}
          confirmLabel="İptal Et"
          danger
          isLoading={isCanceling}
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelingVisitor(null)}
        />
      )}

      {/* New Visitor Drawer */}
      {drawerAnimation.phase !== 'closed' && (
        <>
          <button
            type="button"
            className={`drawer-backdrop drawer-${drawerAnimation.phase}`}
            aria-label="Ziyaretçi formunu kapat"
            disabled={drawerAnimation.isClosing || isSaving}
            onClick={handleCloseDrawer}
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className={`management-drawer drawer-${drawerAnimation.phase}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="visitor-drawer-title"
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Ziyaretçi Yönetimi</p>
                <h2 id="visitor-drawer-title" tabIndex={-1} data-drawer-initial-focus>Yeni Ziyaretçi</h2>
                <p className="drawer-description">Ziyaretçinin kimlik ve beklenen ziyaret bilgilerini girin.</p>
              </div>
              <button type="button" className="drawer-close-button" aria-label="Kapat" onClick={handleCloseDrawer} disabled={isSaving}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="drawer-form" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                {formError && (
                  <div className="status-message error-message" role="alert">
                    {formError}
                  </div>
                )}

                {/* Group 1: TEMEL BİLGİLER */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', margin: 0 }}>
                    Temel Bilgiler
                  </h3>

                  <div className="form-field">
                    <label htmlFor="vis-unit">Bağlı Daire *</label>
                    {groupedUnits.length === 0 ? (
                      <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-warning-soft, #fef7e0)', color: 'var(--color-warning, #b06000)', fontSize: '12px', border: '1px solid var(--color-warning-border, #ffe0b2)' }}>
                        Aktif bir daire yerleşiminiz bulunmamaktadır. Ziyaretçi oluşturmak için aktif daire sakini olmanız gerekmektedir.
                      </div>
                    ) : groupedUnits.length === 1 ? (
                      <div style={{ padding: '10px 12px', background: 'var(--color-surface-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 500 }}>
                        Daire {groupedUnits[0].unitNumber} · {groupedUnits[0].buildingName} · {groupedUnits[0].propertyName}
                      </div>
                    ) : (
                      <select
                        id="vis-unit"
                        required
                        value={formData.unitId}
                        onChange={e => setFormData({ ...formData, unitId: Number(e.target.value) })}
                      >
                        {groupedUnits.map(u => (
                          <option key={u.unitId} value={u.unitId}>
                            Daire {u.unitNumber} · {u.buildingName} · {u.propertyName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div className="form-field">
                      <label htmlFor="vis-name">Ziyaretçi Adı Soyadı *</label>
                      <input
                        id="vis-name"
                        type="text"
                        required
                        placeholder="Örn: Ahmet Yılmaz"
                        value={formData.visitorName}
                        onChange={e => setFormData({ ...formData, visitorName: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="vis-type">Ziyaretçi Tipi *</label>
                      <select
                        id="vis-type"
                        required
                        value={formData.visitorType}
                        onChange={e => setFormData({ ...formData, visitorType: e.target.value as VisitorType })}
                      >
                        <option value="GUEST">Misafir</option>
                        <option value="SERVICE_PROVIDER">Hizmet Sağlayıcı</option>
                        <option value="DELIVERY">Teslimat</option>
                        <option value="COMMERCIAL">Ticari Ziyaret</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Group 2: İLETİŞİM / ARAÇ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', margin: 0 }}>
                    İletişim / Araç
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div className="form-field">
                      <label htmlFor="vis-phone">Telefon (İsteğe Bağlı)</label>
                      <input
                        id="vis-phone"
                        type="text"
                        placeholder="Örn: 05551234567"
                        value={formData.visitorPhone || ''}
                        onChange={e => setFormData({ ...formData, visitorPhone: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="vis-plate">Araç Plakası (İsteğe Bağlı)</label>
                      <input
                        id="vis-plate"
                        type="text"
                        placeholder="Örn: 34 ABC 123"
                        value={formData.vehiclePlate || ''}
                        onChange={e => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                </div>

                {/* Group 3: ZİYARET ZAMANI */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', margin: 0 }}>
                    Ziyaret Zamanı
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div className="form-field">
                      <label htmlFor="vis-arr">Beklenen Giriş Tarihi / Saati *</label>
                      <input
                        id="vis-arr"
                        type="datetime-local"
                        required
                        value={formData.expectedArrival}
                        onChange={e => setFormData({ ...formData, expectedArrival: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="vis-dep">Beklenen Çıkış Tarihi / Saati *</label>
                      <input
                        id="vis-dep"
                        type="datetime-local"
                        required
                        value={formData.expectedDeparture}
                        onChange={e => setFormData({ ...formData, expectedDeparture: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="drawer-actions form-field-full" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', position: 'sticky', bottom: 0, background: 'var(--color-surface)' }}>
                <SaveShortcutHint />
                <button type="button" className="secondary-button" onClick={handleCloseDrawer} disabled={isSaving}>
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSaving || groupedUnits.length === 0}
                >
                  {isSaving ? 'Kaydediliyor...' : 'Ziyaretçi Oluştur'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {unsavedChangesDialog}
    </section>
  )
}
