import { useState, useEffect, useCallback } from 'react'
import {
  getResidentVisitors,
  createVisitor,
  cancelVisitor,
  getMyUnits,
} from '../api'
import type { Visitor, CreateVisitorPayload, ResidentUnit, VisitorType } from '../types'
import { ConfirmationDialog } from './ConfirmationDialog'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { SaveShortcutHint } from './SaveShortcutHint'
import { useRealtime } from '../realtime/useRealtime'

const VISITOR_TYPE_LABELS: Record<VisitorType, string> = {
  GUEST: 'Misafir',
  SERVICE_PROVIDER: 'Hizmet Sağlayıcı',
  DELIVERY: 'Teslimat',
  COMMERCIAL: 'Ticari Ziyaret',
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  EXPECTED: 'status-badge-pending',
  CHECKED_IN: 'status-badge-approved',
  CHECKED_OUT: 'status-badge-neutral',
  CANCELLED: 'status-badge-rejected',
  EXPIRED: 'status-badge-rejected',
}

const STATUS_LABELS: Record<string, string> = {
  EXPECTED: 'Bekleniyor',
  CHECKED_IN: 'Giriş Yaptı',
  CHECKED_OUT: 'Çıkış Yaptı',
  CANCELLED: 'İptal Edildi',
  EXPIRED: 'Süresi Doldu',
}

export function ResidentVisitors() {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [residentUnits, setResidentUnits] = useState<ResidentUnit[]>([])
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Drawer & Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [createdVisitor, setCreatedVisitor] = useState<Visitor | null>(null)
  const [copied, setCopied] = useState(false)

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
    if (!(await requestDiscard())) return
    setIsDrawerOpen(false)
  }

  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.phase !== 'closed',
    onClose: () => { void handleCloseDrawer() },
    isSaving,
  })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [vList, uList] = await Promise.all([
        getResidentVisitors(),
        getMyUnits(),
      ])
      setVisitors(vList)
      setResidentUnits(uList)

      // Auto-preselect unit if only one
      if (uList.length === 1 && formData.unitId === 0) {
        setFormData(prev => ({ ...prev, unitId: uList[0].unitId }))
      }
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Ziyaretçiler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [formData.unitId])

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

  // Toast Timer
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const handleOpenDrawer = () => {
    // Default dates: arrival = now + 30m, departure = now + 4h
    const now = new Date()
    const arr = new Date(now.getTime() + 30 * 60 * 1000)
    const dep = new Date(now.getTime() + 4 * 60 * 60 * 1000)

    const defaultUnitId = residentUnits.length > 0 ? residentUnits[0].unitId : 0

    setFormData({
      unitId: defaultUnitId,
      visitorName: '',
      visitorPhone: '',
      visitorType: 'GUEST',
      vehiclePlate: '',
      expectedArrival: arr.toISOString().slice(0, 16),
      expectedDeparture: dep.toISOString().slice(0, 16),
    })
    setFormError(null)
    setIsDrawerOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      setIsDrawerOpen(false)
      setCreatedVisitor(created)
      setToastMessage('Ziyaretçi kaydı başarıyla oluşturuldu.')
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ziyaretçi oluşturulamadı.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancelingVisitor) return
    try {
      setIsCanceling(true)
      await cancelVisitor(cancelingVisitor.id)
      setToastMessage('Ziyaretçi kaydı iptal edildi.')
      setCancelingVisitor(null)
      await loadData()
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Ziyaretçi iptal edilemedi.')
    } finally {
      setIsCanceling(false)
    }
  }

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
    <div className="space-y-6">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-lg bg-surface border border-border shadow-lg text-sm text-primary animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-main">Ziyaretçiler</h1>
          <p className="text-sm text-muted mt-1">
            Beklediğiniz ziyaretçileri önceden tanımlayın ve giriş durumlarını takip edin.
          </p>
        </div>
        <button
          type="button"
          className="primary-button inline-flex items-center gap-2 self-start sm:self-auto"
          onClick={handleOpenDrawer}
        >
          <span>Yeni Ziyaretçi</span>
        </button>
      </div>

      {/* Tab Strip */}
      <div className="facility-tab-strip">
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

      {/* Content Section */}
      {loading ? (
        <div className="p-8 text-center text-muted">Ziyaretçiler yükleniyor...</div>
      ) : displayedVisitors.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-surface">
          <p className="text-muted">
            {activeTab === 'upcoming'
              ? 'Yaklaşan ziyaretçi kaydınız bulunmuyor.'
              : 'Geçmiş ziyaretçi kaydınız bulunmuyor.'}
          </p>
          {activeTab === 'upcoming' && (
            <button
              type="button"
              className="primary-button mt-4"
              onClick={handleOpenDrawer}
            >
              Ziyaretçi Oluştur
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedVisitors.map(v => (
            <div
              key={v.id}
              className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-3 hover:border-primary-border transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-main text-base">{v.visitorName}</h3>
                    <p className="text-xs text-muted">
                      {v.buildingName} No: {v.unitNumber}
                    </p>
                  </div>
                  <span className={`status-badge ${STATUS_BADGE_CLASSES[v.status] || 'status-badge-neutral'}`}>
                    {STATUS_LABELS[v.status] || v.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-surface-secondary text-secondary font-medium">
                    {VISITOR_TYPE_LABELS[v.visitorType] || v.visitorType}
                  </span>
                  {v.vehiclePlate && (
                    <span className="px-2 py-0.5 rounded bg-surface-hover font-mono font-semibold text-main">
                      {v.vehiclePlate}
                    </span>
                  )}
                </div>

                <div className="text-xs text-secondary space-y-1">
                  <div>
                    <span className="text-muted font-medium">Giriş: </span>
                    {new Date(v.expectedArrival).toLocaleString('tr-TR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                  <div>
                    <span className="text-muted font-medium">Çıkış: </span>
                    {new Date(v.expectedDeparture).toLocaleString('tr-TR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                  {v.visitorPhone && (
                    <div>
                      <span className="text-muted font-medium">Tel: </span>
                      {v.visitorPhone}
                    </div>
                  )}
                </div>
              </div>

              {/* PIN Code Box & Action */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">PIN:</span>
                  <code className="font-mono text-sm font-bold tracking-wider px-2 py-1 bg-surface-secondary rounded border border-border text-primary">
                    {v.accessCode}
                  </code>
                </div>

                {v.status === 'EXPECTED' && (
                  <button
                    type="button"
                    className="danger-button text-xs py-1 px-2"
                    onClick={() => setCancelingVisitor(v)}
                  >
                    İptal Et
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Created Access Code Dialog */}
      {createdVisitor && (
        <div className="modal-backdrop z-50">
          <div className="modal-card max-w-md w-full p-6 bg-surface rounded-xl border border-border shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-success-soft text-success flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <h3 className="text-lg font-bold text-main">Ziyaretçi Kaydı Oluşturuldu</h3>
              <p className="text-sm text-muted">
                {createdVisitor.visitorName} için oluşturulan 6 haneli giriş kodunu ziyaretçiniz ile paylaşabilirsiniz.
              </p>
            </div>

            <div className="p-4 bg-surface-secondary rounded-xl border border-border text-center space-y-2">
              <span className="text-xs uppercase tracking-wider text-muted font-semibold">Giriş Kodu (PIN)</span>
              <div className="text-3xl font-mono font-bold tracking-widest text-primary">
                {createdVisitor.accessCode}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="secondary-button flex-1"
                onClick={() => copyAccessCode(createdVisitor.accessCode)}
              >
                {copied ? 'Kopyalandı!' : 'Kodu Kopyala'}
              </button>
              <button
                type="button"
                className="primary-button flex-1"
                onClick={() => setCreatedVisitor(null)}
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
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
          <div
            className={`drawer-backdrop ${drawerAnimation.phase === 'open' ? 'backdrop-open' : 'backdrop-closing'}`}
            onClick={handleCloseDrawer}
          />
          <div
            ref={drawerRef as any}
            tabIndex={-1}
            className={`management-drawer drawer-${drawerAnimation.phase}`}
          >
            <div className="drawer-header">
              <h2>Yeni Ziyaretçi</h2>
              <button type="button" className="close-button" onClick={handleCloseDrawer}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="drawer-form flex-1 flex flex-col justify-between">
              <div className="drawer-body space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-danger-soft text-danger text-sm border border-danger-border">
                    {formError}
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="vis-unit">Bağlı Daire *</label>
                  <select
                    id="vis-unit"
                    required
                    value={formData.unitId}
                    onChange={e => setFormData({ ...formData, unitId: Number(e.target.value) })}
                  >
                    {residentUnits.map(u => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.buildingName} - No: {u.unitNumber}
                      </option>
                    ))}
                  </select>
                </div>

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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="drawer-actions form-field-full">
                <SaveShortcutHint />
                <button type="button" className="secondary-button" onClick={handleCloseDrawer}>
                  İptal
                </button>
                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {unsavedChangesDialog}
    </div>
  )
}
