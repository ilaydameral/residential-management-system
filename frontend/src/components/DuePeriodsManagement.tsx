import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelDraftDuePeriod,
  createDraftDuePeriod,
  getDueDefinitions,
  getDuePeriodCollectionDetails,
  getDuePeriods,
  getIssuePeriodPreview,
  issueDuePeriod,
} from '../api'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { LoadingSkeleton } from './LoadingSkeleton'
import type {
  CancelDuePeriodPayload,
  CreateDraftDuePeriodPayload,
  DueDefinition,
  DuePeriod,
  DuePeriodCollectionDetailsDto,
  IssuePeriodPreview,
} from '../types'

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '0,00 ₺'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const MONTH_NAMES: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Ocak' },
  { value: 2, label: 'Şubat' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' },
  { value: 5, label: 'Mayıs' },
  { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' },
  { value: 8, label: 'Ağustos' },
  { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' },
  { value: 11, label: 'Kasım' },
  { value: 12, label: 'Aralık' },
]

export function DuePeriodsManagement() {
  const { showToast } = useToast()

  // Main list & loading state
  const [periods, setPeriods] = useState<DuePeriod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  // Lookups
  const [dueDefinitions, setDueDefinitions] = useState<DueDefinition[]>([])

  // Filters
  const [definitionFilter, setDefinitionFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // New Draft Drawer state & animation hooks
  const [isDraftDrawerOpen, setIsDraftDrawerOpen] = useState(false)
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false)
  const [draftDefinitionId, setDraftDefinitionId] = useState<number>(0)
  const [draftYear, setDraftYear] = useState<number>(new Date().getFullYear())
  const [draftMonth, setDraftMonth] = useState<number>(new Date().getMonth() + 1)
  const [draftError, setDraftError] = useState<string>('')

  const draftDrawerAnimation = useAnimatedDrawer(isDraftDrawerOpen)
  const draftDrawerRef = useDrawerAccessibility({
    isOpen: draftDrawerAnimation.shouldRender && !draftDrawerAnimation.isClosing,
    onClose: () => setIsDraftDrawerOpen(false),
    isSaving: isSubmittingDraft,
  })

  // Preview & Issue Modal state
  const [previewPeriodTarget, setPreviewPeriodTarget] = useState<DuePeriod | null>(null)
  const [previewData, setPreviewData] = useState<IssuePeriodPreview | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [isIssuing, setIsIssuing] = useState(false)

  // Cancel Modal state
  const [cancelPeriodTarget, setCancelPeriodTarget] = useState<DuePeriod | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  // Collection Details Drawer state
  const [collectionPeriodTarget, setCollectionPeriodTarget] = useState<DuePeriod | null>(null)
  const [collectionDetails, setCollectionDetails] = useState<DuePeriodCollectionDetailsDto | null>(null)
  const [isCollectionLoading, setIsCollectionLoading] = useState(false)
  const [collectionError, setCollectionError] = useState('')
  const [collectionFilter, setCollectionFilter] = useState<'ALL' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE' | 'PENDING_SUBMISSION'>('ALL')

  const collectionDrawerAnimation = useAnimatedDrawer(Boolean(collectionPeriodTarget))
  const collectionDrawerRef = useDrawerAccessibility({
    isOpen: collectionDrawerAnimation.shouldRender && !collectionDrawerAnimation.isClosing,
    onClose: () => setCollectionPeriodTarget(null),
  })

  const handleOpenCollectionDetails = async (period: DuePeriod) => {
    setCollectionPeriodTarget(period)
    setCollectionDetails(null)
    setCollectionError('')
    setCollectionFilter('ALL')
    setIsCollectionLoading(true)

    try {
      const data = await getDuePeriodCollectionDetails(period.id)
      setCollectionDetails(data)
    } catch (err) {
      setCollectionError(err instanceof Error ? err.message : 'Tahsilat detayları yüklenemedi.')
    } finally {
      setIsCollectionLoading(false)
    }
  }

  const filteredCollectionUnits = useMemo(() => {
    if (!collectionDetails) return []
    if (collectionFilter === 'ALL') return collectionDetails.units
    if (collectionFilter === 'PENDING_SUBMISSION') {
      return collectionDetails.units.filter((u) => u.hasPendingSubmission)
    }
    return collectionDetails.units.filter((u) => u.status === collectionFilter)
  }, [collectionDetails, collectionFilter])

  // Load due definitions lookup on mount
  useEffect(() => {
    async function loadDefinitionsLookup() {
      try {
        const data = await getDueDefinitions({ isActive: true })
        setDueDefinitions(data)
      } catch (err) {
        // Handled silently
      }
    }
    void loadDefinitionsLookup()
  }, [])

  // Load Due Periods list
  const loadPeriods = useCallback(async () => {
    setIsLoading(true)
    setListError('')
    try {
      const defId = definitionFilter !== 'all' ? Number(definitionFilter) : undefined
      const yr = yearFilter !== 'all' ? Number(yearFilter) : undefined
      const mn = monthFilter !== 'all' ? Number(monthFilter) : undefined
      const st = statusFilter !== 'all' ? statusFilter : undefined

      const data = await getDuePeriods({
        dueDefinitionId: defId,
        year: yr,
        month: mn,
        status: st,
      })
      setPeriods(data)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Aidat dönemleri yüklenemedi.')
      showToast('Aidat dönemleri yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [definitionFilter, yearFilter, monthFilter, statusFilter, showToast])

  useEffect(() => {
    void loadPeriods()
  }, [loadPeriods])

  // Open Create Draft Drawer
  const handleOpenDraftDrawer = () => {
    setDraftDefinitionId(dueDefinitions[0]?.id || 0)
    setDraftYear(new Date().getFullYear())
    setDraftMonth(new Date().getMonth() + 1)
    setDraftError('')
    setIsDraftDrawerOpen(true)
  }

  // Submit Draft Form
  const handleSubmitDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    setDraftError('')

    if (!draftDefinitionId) {
      setDraftError('Lütfen bir aidat tanımı seçin.')
      return
    }

    setIsSubmittingDraft(true)
    try {
      const payload: CreateDraftDuePeriodPayload = {
        dueDefinitionId: draftDefinitionId,
        year: draftYear,
        month: draftMonth,
      }
      await createDraftDuePeriod(payload)
      showToast('Taslak aidat dönemi başarıyla oluşturuldu.')
      setIsDraftDrawerOpen(false)
      void loadPeriods()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Taslak oluşturulamadı.'
      setDraftError(msg)
      showToast(msg)
    } finally {
      setIsSubmittingDraft(false)
    }
  }

  // Open Issue Preview Modal
  const handleOpenIssuePreview = async (period: DuePeriod) => {
    setPreviewPeriodTarget(period)
    setPreviewData(null)
    setPreviewError('')
    setIsPreviewLoading(true)
    try {
      const data = await getIssuePeriodPreview(period.id)
      setPreviewData(data)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Borçlandırma önizlemesi yüklenemedi.')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // Confirm and Issue Due Period
  const handleConfirmIssue = async () => {
    if (!previewPeriodTarget) return
    setIsIssuing(true)
    try {
      await issueDuePeriod(previewPeriodTarget.id)
      showToast('Aidat dönemi başarıyla borçlandırıldı ve yayınlandı.')
      setPreviewPeriodTarget(null)
      setPreviewData(null)
      void loadPeriods()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Borçlandırma işlemi gerçekleştirilemedi.')
    } finally {
      setIsIssuing(false)
    }
  }

  // Open Cancel Modal
  const handleOpenCancelModal = (period: DuePeriod) => {
    setCancelPeriodTarget(period)
    setCancellationReason('')
    setCancelError('')
  }

  // Submit Cancel Form
  const handleSubmitCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancelPeriodTarget) return
    setCancelError('')

    if (!cancellationReason.trim() || cancellationReason.trim().length < 3) {
      setCancelError('İptal gerekçesi en az 3 karakter olmalıdır.')
      return
    }

    setIsCancelling(true)
    try {
      const payload: CancelDuePeriodPayload = {
        cancellationReason: cancellationReason.trim(),
      }
      await cancelDraftDuePeriod(cancelPeriodTarget.id, payload)
      showToast('Aidat dönemi iptal edildi.')
      setCancelPeriodTarget(null)
      void loadPeriods()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Dönem iptal edilemedi.'
      setCancelError(msg)
      showToast(msg)
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="section-container entity-management-view">
      {/* Standard Entity Page Actions Header */}
      <div className="entity-page-actions">
        <p>{!isLoading && !listError ? `${periods.length} aidat dönemi gösteriliyor.` : 'Aidat dönemlerini görüntüleyin.'}</p>
        <button
          type="button"
          className="primary-button"
          onClick={handleOpenDraftDrawer}
        >
          + Yeni Taslak Dönem
        </button>
      </div>

      {/* Standard Entity Toolbar */}
      <section className="panel entity-toolbar due-toolbar" aria-label="Aidat dönemi filtreleri">
        <div className="form-field">
          <label htmlFor="period-def-filter">Aidat Tanımı</label>
          <select
            id="period-def-filter"
            value={definitionFilter}
            onChange={(e) => setDefinitionFilter(e.target.value)}
          >
            <option value="all">Tüm Aidat Tanımları</option>
            {dueDefinitions.map((d) => (
              <option key={d.id} value={d.id.toString()}>{d.title}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="period-year-filter">Yıl</label>
          <select
            id="period-year-filter"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="all">Tüm Yıllar</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="period-month-filter">Ay</label>
          <select
            id="period-month-filter"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="all">Tüm Aylar</option>
            {MONTH_NAMES.map((m) => (
              <option key={m.value} value={m.value.toString()}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="period-status-filter">Durum</label>
          <select
            id="period-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tüm durumlar</option>
            <option value="DRAFT">Taslak (DRAFT)</option>
            <option value="ISSUED">Yayınlandı (ISSUED)</option>
            <option value="CANCELLED">İptal Edildi (CANCELLED)</option>
          </select>
        </div>
      </section>

      {/* Main Content: Standardized Management Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : listError ? (
        <div className="panel status-message error-message">
          <p>{listError}</p>
          <button type="button" className="secondary-button" style={{ marginTop: '8px' }} onClick={() => { void loadPeriods() }}>
            Tekrar Dene
          </button>
        </div>
      ) : periods.length === 0 ? (
        <div className="panel status-message" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Kayıtlı aidat dönemi bulunamadı.</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
            Filtrelerinizi değiştirebilir veya yeni bir taslak dönem oluşturabilirsiniz.
          </p>
        </div>
      ) : (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Dönem</th>
                  <th>Aidat Tanımı</th>
                  <th>Kapsam</th>
                  <th className="text-right">Birim Tutar</th>
                  <th>Son Ödeme</th>
                  <th>Durum</th>
                  <th className="text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((item) => {
                  let badgeClass = 'warning'
                  let badgeText = 'Taslak'

                  if (item.status === 'ISSUED') {
                    badgeClass = 'active'
                    badgeText = 'Yayınlandı'
                  } else if (item.status === 'CANCELLED') {
                    badgeClass = 'inactive'
                    badgeText = 'İptal Edildi'
                  }

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="due-period-title">{item.periodName}</div>
                      </td>
                      <td>
                        <span>{item.dueDefinitionTitle}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>
                          {item.buildingName ? `${item.propertyName} · ${item.buildingName}` : `${item.propertyName} (Site Geneli)`}
                        </span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
                        {formatCurrency(item.unitAmount)}
                      </td>
                      <td>
                        <span>{formatDate(item.dueDate)}</span>
                      </td>
                      <td>
                        <div className="due-status-wrapper">
                          <span className={`status-badge ${badgeClass}`}>
                            {badgeText}
                          </span>
                          {item.status === 'ISSUED' && item.issuedAt && (
                            <div className="due-period-subtext">
                              {formatDate(item.issuedAt)}
                            </div>
                          )}
                          {item.status === 'CANCELLED' && item.cancelledAt && (
                            <div className="due-period-subtext" title={item.cancellationReason || ''}>
                              {formatDate(item.cancelledAt)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        {item.status === 'ISSUED' ? (
                          <button
                            type="button"
                            className="primary-button"
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            onClick={() => { void handleOpenCollectionDetails(item) }}
                          >
                            Tahsilat Detayı
                          </button>
                        ) : item.status === 'DRAFT' ? (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="primary-button"
                              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                              onClick={() => { void handleOpenIssuePreview(item) }}
                            >
                              Önizle ve Yayınla
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--color-danger)' }}
                              onClick={() => handleOpenCancelModal(item)}
                            >
                              İptal Et
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            —
                          </span>
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

      {/* Drawer for Create Draft Period */}
      {draftDrawerAnimation.shouldRender && (
        <>
          <button
            className={`drawer-backdrop drawer-${draftDrawerAnimation.phase}`}
            type="button"
            aria-label="Kapat"
            disabled={draftDrawerAnimation.isClosing}
            onClick={() => setIsDraftDrawerOpen(false)}
          />
          <aside
            ref={draftDrawerRef}
            tabIndex={-1}
            className={`management-drawer drawer-${draftDrawerAnimation.phase}`}
            role="dialog"
            aria-modal="true"
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Aidat Yönetimi</p>
                <h2>Yeni Taslak Aidat Dönemi</h2>
                <p className="drawer-description">Aidat tanımına bağlı yeni dönem borçlandırma taslağı hazırlayın.</p>
              </div>
              <button className="drawer-close-button" type="button" onClick={() => setIsDraftDrawerOpen(false)}>×</button>
            </div>

            <form className="property-form drawer-form" onSubmit={(e) => { void handleSubmitDraft(e) }}>
              {draftError && (
                <div className="status-message error-message">
                  {draftError}
                </div>
              )}

              {/* Due Definition Select */}
              <div className="form-field form-field-full">
                <label htmlFor="draft-due-def-select">
                  Aidat Tanımı *
                </label>
                <select
                  id="draft-due-def-select"
                  value={draftDefinitionId}
                  onChange={(e) => setDraftDefinitionId(Number(e.target.value))}
                  required
                >
                  <option value={0} disabled>Aidat Tanımı Seçin</option>
                  {dueDefinitions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.buildingName ? `${d.propertyName} · ${d.buildingName}` : d.propertyName}) - {formatCurrency(d.amount)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year Select */}
              <div className="form-field form-field-full">
                <label htmlFor="draft-year-select">
                  Dönem Yılı *
                </label>
                <select
                  id="draft-year-select"
                  value={draftYear}
                  onChange={(e) => setDraftYear(Number(e.target.value))}
                  required
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              {/* Month Select */}
              <div className="form-field form-field-full">
                <label htmlFor="draft-month-select">
                  Dönem Ayı *
                </label>
                <select
                  id="draft-month-select"
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(Number(e.target.value))}
                  required
                >
                  {MONTH_NAMES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-field form-field-full" style={{ padding: '12px', background: 'var(--color-surface-secondary)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                <strong>Bilgilendirme:</strong> Son ödeme tarihi ve daire başı tutar snapshot bilgisi, seçilen aidat tanımındaki tanımlamalara göre backend tarafından otomatik üretilecektir.
              </div>

              {/* Submit Action */}
              <div className="drawer-actions form-field-full">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsDraftDrawerOpen(false)}
                  disabled={isSubmittingDraft}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmittingDraft}
                >
                  <span>{isSubmittingDraft ? 'Oluşturuluyor...' : 'Taslak Oluştur'}</span>
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* Preview & Issue Modal */}
      {previewPeriodTarget && (
        <div className="confirmation-overlay" role="presentation">
          <div className="confirmation-dialog" style={{ maxWidth: '520px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
              Aidat Dönemi Borçlandırma Önizlemesi
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              Yayınlama işlemi sonrasında ilgili tüm dairelere borçlandırma yansıtılacaktır.
            </p>

            {isPreviewLoading ? (
              <LoadingSkeleton variant="table" rows={3} />
            ) : previewError ? (
              <div className="status-message error-message">{previewError}</div>
            ) : previewData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--color-surface-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Dönem Adı:</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{previewData.periodName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Hedef Daire Sayısı:</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{previewData.targetUnitCount} Daire</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Daire Başı Tutar:</span>
                  <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(previewData.unitDuesAmount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Toplam Tahakkuk:</span>
                  <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>{formatCurrency(previewData.totalExpectedAmount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Son Ödeme Tarihi:</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{formatDate(previewData.dueDate)}</strong>
                </div>
              </div>
            ) : null}

            <div className="confirmation-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPreviewPeriodTarget(null)}
                disabled={isIssuing}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isIssuing || Boolean(previewError) || isPreviewLoading}
                onClick={() => { void handleConfirmIssue() }}
              >
                <span>{isIssuing ? 'Yayınlanıyor...' : 'Onayla ve Yayınla'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelPeriodTarget && (
        <div className="confirmation-overlay" role="presentation">
          <div className="confirmation-dialog" style={{ maxWidth: '460px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
              Taslak Aidat Dönemini İptal Et
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              "{cancelPeriodTarget.periodName}" taslak dönemini iptal etmek üzeresiniz. Lütfen bir gerekçe girin.
            </p>

            <form onSubmit={(e) => { void handleSubmitCancel(e) }}>
              {cancelError && (
                <div className="status-message error-message" style={{ marginBottom: '12px' }}>
                  {cancelError}
                </div>
              )}

              <div className="form-field" style={{ marginBottom: '20px' }}>
                <label htmlFor="cancel-period-reason">
                  İptal Gerekçesi *
                </label>
                <textarea
                  id="cancel-period-reason"
                  rows={3}
                  maxLength={500}
                  placeholder="İptal gerekçesini açıklayın..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  required
                />
              </div>

              <div className="confirmation-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setCancelPeriodTarget(null)}
                  disabled={isCancelling}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="action-button danger-btn"
                  disabled={isCancelling}
                >
                  <span>{isCancelling ? 'İptal Ediliyor...' : 'İptal Et'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection Details Drawer */}
      {collectionDrawerAnimation.shouldRender && (
        <>
          <button
            className={`drawer-backdrop drawer-${collectionDrawerAnimation.phase}`}
            type="button"
            aria-label="Kapat"
            disabled={collectionDrawerAnimation.isClosing}
            onClick={() => setCollectionPeriodTarget(null)}
          />
          <aside
            ref={collectionDrawerRef}
            tabIndex={-1}
            className={`management-drawer drawer-${collectionDrawerAnimation.phase}`}
            role="dialog"
            aria-modal="true"
            style={{ width: '880px', maxWidth: '95vw' }}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Aidat Tahsilat Raporu</p>
                <h2>{collectionPeriodTarget?.periodName} — Tahsilat Detayı</h2>
                <p className="drawer-description">
                  {collectionPeriodTarget?.dueDefinitionTitle} · Son Ödeme: {formatDate(collectionPeriodTarget?.dueDate)}
                </p>
              </div>
              <button className="drawer-close-button" type="button" onClick={() => setCollectionPeriodTarget(null)}>×</button>
            </div>

            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              {isCollectionLoading ? (
                <LoadingSkeleton variant="table" rows={6} />
              ) : collectionError ? (
                <div className="status-message error-message">{collectionError}</div>
              ) : collectionDetails ? (
                <>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                    <div className="panel" style={{ padding: '16px', background: 'var(--color-surface-secondary)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Toplam Daire</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {collectionDetails.summary.totalUnitCount} Daire
                      </div>
                    </div>

                    <div className="panel" style={{ padding: '16px', background: 'var(--color-surface-secondary)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Toplam Tahakkuk</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {formatCurrency(collectionDetails.summary.totalAssessedAmount)}
                      </div>
                    </div>

                    <div className="panel" style={{ padding: '16px', background: 'var(--color-surface-secondary)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Toplam Tahsilat</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-success)' }}>
                        {formatCurrency(collectionDetails.summary.totalCollectedAmount)}
                      </div>
                    </div>

                    <div className="panel" style={{ padding: '16px', background: 'var(--color-surface-secondary)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Kalan Borç</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: collectionDetails.summary.totalOutstandingAmount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                        {formatCurrency(collectionDetails.summary.totalOutstandingAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Status Pills Summary */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <span className="status-badge active" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                      Ödeyen: {collectionDetails.summary.paidUnitCount} Daire
                    </span>
                    <span className="status-badge warning" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                      Kısmi Ödeyen: {collectionDetails.summary.partiallyPaidUnitCount} Daire
                    </span>
                    <span className="status-badge inactive" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                      Ödenmedi: {collectionDetails.summary.unpaidUnitCount} Daire
                    </span>
                    {collectionDetails.summary.overdueUnitCount > 0 && (
                      <span className="status-badge inactive" style={{ padding: '4px 10px', fontSize: '0.78rem', backgroundColor: '#fef2f2', color: '#991b1b' }}>
                        Gecikmiş: {collectionDetails.summary.overdueUnitCount} Daire
                      </span>
                    )}
                    {collectionDetails.summary.pendingSubmissionUnitCount > 0 && (
                      <span className="status-badge" style={{ padding: '4px 10px', fontSize: '0.78rem', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                        Bekleyen Dekont: {collectionDetails.summary.pendingSubmissionUnitCount} Daire
                      </span>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', overflowX: 'auto' }}>
                    {[
                      { key: 'ALL', label: `Tümü (${collectionDetails.units.length})` },
                      { key: 'PAID', label: `Ödendi (${collectionDetails.summary.paidUnitCount})` },
                      { key: 'PARTIALLY_PAID', label: `Kısmi Ödendi (${collectionDetails.summary.partiallyPaidUnitCount})` },
                      { key: 'UNPAID', label: `Ödenmedi (${collectionDetails.summary.unpaidUnitCount})` },
                      { key: 'OVERDUE', label: `Gecikmiş (${collectionDetails.summary.overdueUnitCount})` },
                      { key: 'PENDING_SUBMISSION', label: `Bekleyen Bildirim (${collectionDetails.summary.pendingSubmissionUnitCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={collectionFilter === tab.key ? 'primary-button' : 'secondary-button'}
                        style={{ padding: '4px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                        onClick={() => setCollectionFilter(tab.key as typeof collectionFilter)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Daireler Tablosu */}
                  <div className="table-responsive">
                    <table className="management-table">
                      <thead>
                        <tr>
                          <th>Daire</th>
                          <th>Gayrimenkul / Bina</th>
                          <th className="text-right">Borç Tutarı</th>
                          <th className="text-right">Tahsil Edilen</th>
                          <th className="text-right">Kalan Bakiye</th>
                          <th>Bekleyen Dekont</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCollectionUnits.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                              Seçilen filtreye uygun daire bulunamadı.
                            </td>
                          </tr>
                        ) : (
                          filteredCollectionUnits.map((u) => {
                            let badgeClass = 'inactive'
                            let badgeText = 'Ödenmedi'

                            if (u.status === 'PAID') {
                              badgeClass = 'active'
                              badgeText = 'Ödendi'
                            } else if (u.status === 'PARTIALLY_PAID') {
                              badgeClass = 'warning'
                              badgeText = 'Kısmi Ödendi'
                            } else if (u.status === 'OVERDUE') {
                              badgeClass = 'inactive'
                              badgeText = 'Gecikmiş'
                            }

                            return (
                              <tr key={u.unitChargeId}>
                                <td>
                                  <strong style={{ color: 'var(--color-text-primary)' }}>Daire {u.unitNumber}</strong>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.82rem' }}>{u.propertyName} · {u.buildingName}</span>
                                </td>
                                <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {formatCurrency(u.amount)}
                                </td>
                                <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-success)', fontWeight: 600 }}>
                                  {formatCurrency(u.paidAmount)}
                                </td>
                                <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: u.remainingAmount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)', fontWeight: 700 }}>
                                  {formatCurrency(u.remainingAmount)}
                                </td>
                                <td>
                                  {u.hasPendingSubmission ? (
                                    <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                      {formatCurrency(u.pendingSubmissionAmount)} (İncelemede)
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  <span className={`status-badge ${badgeClass}`}>
                                    {badgeText}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
