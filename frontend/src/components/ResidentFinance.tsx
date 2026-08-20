import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelResidentPaymentSubmission,
  createResidentPaymentSubmission,
  getResidentFinanceSummary,
  getResidentPaymentSubmissions,
  getResidentUnitCharges,
} from '../api'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { LoadingSkeleton } from './LoadingSkeleton'
import type {
  PaymentSubmission,
  ResidentFinanceSummaryDto,
  ResidentUnitCharge,
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
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatDateOnly(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf']
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

const PAYMENT_METHOD_MAP: Record<string, string> = {
  BANK_TRANSFER: 'Banka Havalesi / EFT',
  CREDIT_CARD: 'Kredi Kartı',
  CASH: 'Nakit',
  OTHER: 'Diğer',
}

function formatPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Belirtilmedi'
  const key = method.trim().toUpperCase().replace(/[\s-]/g, '_')
  return PAYMENT_METHOD_MAP[key] || method
}

const CHARGE_TYPE_MAP: Record<string, string> = {
  DUES: 'Aidat',
  EXPENSE_RECOVERY: 'Gider Payı',
  MANUAL: 'Manuel Borç',
}

function formatChargeTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Aidat'
  const key = type.trim().toUpperCase()
  return CHARGE_TYPE_MAP[key] || type
}

export function ResidentFinance() {
  const { showToast } = useToast()

  // Main data states
  const [summary, setSummary] = useState<ResidentFinanceSummaryDto | null>(null)
  const [unitCharges, setUnitCharges] = useState<ResidentUnitCharge[]>([])
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // Active Tab for filter
  const [chargeFilter, setChargeFilter] = useState<'open' | 'all' | 'paid'>('open')

  // Payment Submission Modal/Drawer state
  const [targetCharge, setTargetCharge] = useState<ResidentUnitCharge | null>(null)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)

  // Submission Form fields
  const [submitAmount, setSubmitAmount] = useState<string>('')
  const [submitPaymentDate, setSubmitPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [submitPaymentMethod, setSubmitPaymentMethod] = useState<string>('BANK_TRANSFER')
  const [submitRefCode, setSubmitRefCode] = useState<string>('')
  const [submitUserNotes, setSubmitUserNotes] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Drag and Drop state
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Charge Detail Drawer
  const [detailCharge, setDetailCharge] = useState<ResidentUnitCharge | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)

  const drawerAnimation = useAnimatedDrawer(isDetailDrawerOpen)
  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.shouldRender && !drawerAnimation.isClosing,
    onClose: () => setIsDetailDrawerOpen(false),
  })

  // Cancel Submission Modal state
  const [cancelTargetSubmission, setCancelTargetSubmission] = useState<PaymentSubmission | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  // Fetch all resident finance data
  const loadResidentFinanceData = useCallback(async () => {
    setIsLoading(true)
    setErrorMsg('')
    try {
      const [sumData, chargesData, subsData] = await Promise.all([
        getResidentFinanceSummary(),
        getResidentUnitCharges(),
        getResidentPaymentSubmissions(),
      ])
      setSummary(sumData)
      setUnitCharges(chargesData)
      setSubmissions(subsData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Finans verileri yüklenemedi.'
      setErrorMsg(msg)
      showToast(msg)
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadResidentFinanceData()
  }, [loadResidentFinanceData])

  // Filter unit charges
  const filteredCharges = useMemo(() => {
    if (chargeFilter === 'open') {
      return unitCharges.filter((c) => c.remainingAmount > 0 && !c.isCancelled)
    }
    if (chargeFilter === 'paid') {
      return unitCharges.filter((c) => c.status === 'PAID')
    }
    return unitCharges
  }, [unitCharges, chargeFilter])

  // File selection & validation helper
  const handleSelectFile = (file: File | null) => {
    setFormError('')
    if (!file) {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
      setSelectedFile(null)
      setFilePreviewUrl(null)
      return
    }

    // Validate Extension
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFormError('Geçersiz dosya formatı. Yalnızca PNG, JPG, JPEG ve PDF kabul edilir.')
      return
    }

    // Validate Size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFormError('Dosya boyutu 5 MB sınırını aşamaz.')
      return
    }

    // Revoke existing preview
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)

    setSelectedFile(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFilePreviewUrl(url)
    } else {
      setFilePreviewUrl(null)
    }
  }

  // Cleanup object URL when preview unmounts
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl)
      }
    }
  }, [filePreviewUrl])

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      handleSelectFile(file)
    }
  }

  // Open "Ödeme Bildir" modal
  const handleOpenSubmitModal = (charge: ResidentUnitCharge) => {
    setTargetCharge(charge)
    setSubmitAmount(charge.remainingAmount.toString())
    setSubmitPaymentDate(new Date().toISOString().split('T')[0])
    setSubmitPaymentMethod('BANK_TRANSFER')
    setSubmitRefCode('')
    setSubmitUserNotes('')
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    setSelectedFile(null)
    setFilePreviewUrl(null)
    setFormError('')
    setIsSubmitModalOpen(true)
  }

  // Submit Payment Submission Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetCharge) return
    setFormError('')

    const numAmount = Number.parseFloat(submitAmount.replace(',', '.'))
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      setFormError('Lütfen 0\'dan büyük geçerli bir ödeme tutarı girin.')
      return
    }

    if (numAmount > targetCharge.remainingAmount + 0.01) {
      setFormError(`Ödeme tutarı kalan borç tutarını (${formatCurrency(targetCharge.remainingAmount)}) aşamaz.`)
      return
    }

    if (!selectedFile) {
      setFormError('Lütfen ödemeye ait dekont dosyasını yükleyin.')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('UnitChargeId', targetCharge.id.toString())
      formData.append('Amount', numAmount.toString())
      formData.append('PaymentDate', new Date(submitPaymentDate).toISOString())
      formData.append('PaymentMethod', submitPaymentMethod)
      if (submitRefCode.trim()) formData.append('ReferenceCode', submitRefCode.trim())
      if (submitUserNotes.trim()) formData.append('UserNotes', submitUserNotes.trim())
      formData.append('ReceiptFile', selectedFile)

      await createResidentPaymentSubmission(formData)

      showToast('Ödeme bildiriminiz başarıyla oluşturuldu ve incelemeye gönderildi.')
      setIsSubmitModalOpen(false)
      void loadResidentFinanceData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ödeme bildirimi gönderilemedi.'
      setFormError(msg)
      showToast(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Cancel Submission
  const handleConfirmCancelSubmission = async () => {
    if (!cancelTargetSubmission) return
    setIsCancelling(true)
    try {
      await cancelResidentPaymentSubmission(cancelTargetSubmission.id)
      showToast('Ödeme bildirimi iptal edildi.')
      setCancelTargetSubmission(null)
      void loadResidentFinanceData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ödeme bildirimi iptal edilemedi.'
      showToast(msg)
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="section-container entity-management-view">
      {/* Page Action Header */}
      <div className="entity-page-actions">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>Finans</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Borçlarınızı, ödeme durumunuzu ve gönderdiğiniz ödeme bildirimlerini takip edin.
          </p>
        </div>
      </div>

      {/* Finance Summary Cards */}
      {isLoading ? (
        <LoadingSkeleton variant="dashboard" rows={1} />
      ) : summary ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div className="panel" style={{ padding: '16px', background: 'var(--color-surface)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block' }}>Kalan Toplam Borç</span>
            <strong style={{ fontSize: '1.45rem', fontWeight: 800, color: summary.totalOutstanding > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
              {formatCurrency(summary.totalOutstanding)}
            </strong>
          </div>

          <div className="panel" style={{ padding: '16px', background: 'var(--color-surface)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block' }}>Toplam Ödenen</span>
            <strong style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-success)' }}>
              {formatCurrency(summary.totalPaid)}
            </strong>
          </div>

          <div className="panel" style={{ padding: '16px', background: 'var(--color-surface)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block' }}>Toplam Tahakkuk</span>
            <strong style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {formatCurrency(summary.totalCharged)}
            </strong>
          </div>

          <div className="panel" style={{ padding: '16px', background: 'var(--color-surface)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block' }}>Gecikmiş Borç Sayısı</span>
            <strong style={{ fontSize: '1.45rem', fontWeight: 800, color: summary.overdueChargeCount > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
              {summary.overdueChargeCount} Adet
            </strong>
          </div>

          <div className="panel" style={{ padding: '16px', background: 'var(--color-surface)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block' }}>İncelemedeki Bildirimler</span>
            <strong style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {summary.pendingSubmissionCount} Adet
            </strong>
          </div>
        </div>
      ) : null}

      {/* Main Section: Unit Charges List */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-text-primary)' }}>
            Daire Borçlarım
          </h3>

          <div className="detail-tabs" style={{ padding: '3px' }}>
            <button
              type="button"
              className={chargeFilter === 'open' ? 'active' : ''}
              onClick={() => setChargeFilter('open')}
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              Açık Borçlar
            </button>
            <button
              type="button"
              className={chargeFilter === 'all' ? 'active' : ''}
              onClick={() => setChargeFilter('all')}
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              Tüm Borçlar
            </button>
            <button
              type="button"
              className={chargeFilter === 'paid' ? 'active' : ''}
              onClick={() => setChargeFilter('paid')}
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              Ödenenler
            </button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton variant="table" rows={3} />
        ) : errorMsg ? (
          <div className="panel status-message error-message">
            <p>{errorMsg}</p>
            <button type="button" className="secondary-button" style={{ marginTop: '8px' }} onClick={() => { void loadResidentFinanceData() }}>
              Tekrar Dene
            </button>
          </div>
        ) : filteredCharges.length === 0 ? (
          <div className="panel status-message" style={{ textAlign: 'center', padding: '32px' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Gösterilecek borç kaydı bulunmuyor.</p>
          </div>
        ) : (
          <section className="panel entity-table-panel">
            <div className="responsive-table-wrapper">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>Borç Kalemi / Daire</th>
                    <th>Tür</th>
                    <th className="text-right">Tutar</th>
                    <th className="text-right">Ödenen / Kalan</th>
                    <th>Son Ödeme Tarihi</th>
                    <th style={{ textAlign: 'center' }}>Durum</th>
                    <th className="text-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCharges.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                          {item.title}
                        </strong>
                        <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {item.propertyName} · {item.buildingName} · No: {item.unitNumber}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                          {formatChargeTypeLabel(item.chargeType)}
                        </span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-success)' }}>
                          Ödenen: {formatCurrency(item.paidAmount)}
                        </div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: item.remainingAmount > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                          Kalan: {formatCurrency(item.remainingAmount)}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.84rem' }}>{formatDateOnly(item.dueDate)}</span>
                      </td>
                      <td>
                        <div className="due-status-wrapper">
                          {item.status === 'PAID' ? (
                            <span className="status-badge active">Ödendi</span>
                          ) : item.status === 'PARTIALLY_PAID' ? (
                            <span className="status-badge info">Kısmi Ödendi</span>
                          ) : item.status === 'OVERDUE' ? (
                            <span className="status-badge danger">Gecikmiş</span>
                          ) : item.status === 'CANCELLED' ? (
                            <span className="status-badge inactive">İptal Edildi</span>
                          ) : (
                            <span className="status-badge warning">Bekliyor</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {item.remainingAmount > 0 && !item.isCancelled && (
                            <button
                              type="button"
                              className="primary-button"
                              style={{ padding: '4px 10px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                              onClick={() => handleOpenSubmitModal(item)}
                            >
                              Ödeme Bildir
                            </button>
                          )}
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              setDetailCharge(item)
                              setIsDetailDrawerOpen(true)
                            }}
                          >
                            Detay
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Section: Payment Submissions History */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: '1.15rem', color: 'var(--color-text-primary)' }}>
          Gönderdiğim Ödeme Bildirimleri
        </h3>

        {isLoading ? (
          <LoadingSkeleton variant="table" rows={2} />
        ) : submissions.length === 0 ? (
          <div className="panel status-message" style={{ textAlign: 'center', padding: '24px' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
              Henüz gönderilmiş ödeme bildiriminiz bulunmamaktadır.
            </p>
          </div>
        ) : (
          <section className="panel entity-table-panel">
            <div className="responsive-table-wrapper">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>İlgili Borç Kalemi</th>
                    <th className="text-right">Bildirilen Tutar</th>
                    <th>Ödeme Tarihi</th>
                    <th>Yöntem</th>
                    <th>Referans No</th>
                    <th>Bildirim Tarihi</th>
                    <th style={{ textAlign: 'center' }}>Durum</th>
                    <th className="text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                          {sub.unitChargeTitle}
                        </strong>
                        <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                          {sub.propertyName} · {sub.buildingName} · No: {sub.unitNumber}
                        </div>
                        {sub.rejectionReason && sub.status === 'REJECTED' && (
                          <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--color-danger)' }}>
                            <strong>Red Gerekçesi:</strong> {sub.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="text-right" style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary)' }}>
                        {formatCurrency(sub.amount)}
                      </td>
                      <td>
                        <span>{formatDateOnly(sub.paymentDate)}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                          {formatPaymentMethodLabel(sub.paymentMethod)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                          {sub.referenceCode || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          {formatDate(sub.createdAt)}
                        </span>
                      </td>
                      <td>
                        <div className="due-status-wrapper">
                          {sub.status === 'PENDING' ? (
                            <span className="status-badge warning">İncelemede</span>
                          ) : sub.status === 'APPROVED' ? (
                            <span className="status-badge active">Onaylandı</span>
                          ) : sub.status === 'REJECTED' ? (
                            <span className="status-badge danger">Reddedildi</span>
                          ) : (
                            <span className="status-badge inactive">İptal Edildi</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        {sub.status === 'PENDING' && (
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ padding: '4px 8px', fontSize: '0.76rem', whiteSpace: 'nowrap', color: 'var(--color-danger)' }}
                            onClick={() => setCancelTargetSubmission(sub)}
                          >
                            İptal Et
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Payment Submission Modal / Drawer */}
      {isSubmitModalOpen && targetCharge && (
        <div className="confirmation-overlay" role="presentation">
          <div className="confirmation-dialog" style={{ maxWidth: '540px', textAlign: 'left' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>
              Ödeme Bildirimi Oluştur
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--color-text-secondary)' }}>
              "{targetCharge.title}" borcu için ödeme dekontunuzu yükleyin.
            </p>

            <form onSubmit={(e) => { void handleSubmitForm(e) }}>
              {formError && (
                <div className="status-message error-message" style={{ marginBottom: '14px', fontSize: '0.82rem' }}>
                  {formError}
                </div>
              )}

              {/* Charge Context Box */}
              <div style={{ background: 'var(--color-surface-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Kalan Borç Tutarınız</span>
                  <strong style={{ fontSize: '1.15rem', color: 'var(--color-primary)', fontWeight: 800 }}>{formatCurrency(targetCharge.remainingAmount)}</strong>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  Son Ödeme: {formatDateOnly(targetCharge.dueDate)}
                </div>
              </div>

              {/* Amount & Date row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div className="form-field">
                  <label htmlFor="sub-amount">Ödenen / Bildirilen Tutar (₺) *</label>
                  <input
                    id="sub-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={targetCharge.remainingAmount}
                    value={submitAmount}
                    onChange={(e) => setSubmitAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="sub-date">Ödeme Tarihi *</label>
                  <input
                    id="sub-date"
                    type="date"
                    value={submitPaymentDate}
                    onChange={(e) => setSubmitPaymentDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Payment Method & Reference row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div className="form-field">
                  <label htmlFor="sub-method">Ödeme Yöntemi *</label>
                  <select
                    id="sub-method"
                    value={submitPaymentMethod}
                    onChange={(e) => setSubmitPaymentMethod(e.target.value)}
                  >
                    <option value="BANK_TRANSFER">Banka Havalesi / EFT</option>
                    <option value="CREDIT_CARD">Kredi Kartı</option>
                    <option value="CASH">Nakit</option>
                    <option value="OTHER">Diğer</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="sub-ref">Referans / Dekont No</label>
                  <input
                    id="sub-ref"
                    type="text"
                    maxLength={100}
                    placeholder="Örn: REF-109283"
                    value={submitRefCode}
                    onChange={(e) => setSubmitRefCode(e.target.value)}
                  />
                </div>
              </div>

              {/* User Notes */}
              <div className="form-field" style={{ marginBottom: '16px' }}>
                <label htmlFor="sub-notes">Açıklama / Not (Opsiyonel)</label>
                <textarea
                  id="sub-notes"
                  rows={2}
                  maxLength={500}
                  placeholder="Yöneticiye iletmek istediğiniz not..."
                  value={submitUserNotes}
                  onChange={(e) => setSubmitUserNotes(e.target.value)}
                />
              </div>

              {/* Drag and Drop Dekont Upload Area */}
              <div className="form-field" style={{ marginBottom: '20px' }}>
                <label>Dekont Belgesi Yükle (PNG, JPG, JPEG, PDF - Maks 5MB) *</label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    handleSelectFile(file)
                  }}
                />

                {!selectedFile ? (
                  <div
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                      borderRadius: '10px',
                      padding: '24px 16px',
                      textAlign: 'center',
                      background: isDragging ? 'var(--color-primary-soft)' : 'var(--color-surface-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📄</div>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                      Dekontu buraya sürükleyin veya dosya seçin
                    </p>
                    <small style={{ color: 'var(--color-text-secondary)', display: 'block' }}>
                      PNG, JPG, JPEG veya PDF (Maksimum 5 MB)
                    </small>
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--color-border-strong)', borderRadius: '10px', padding: '14px', background: 'var(--color-surface-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{ fontSize: '1.6rem' }}>
                          {selectedFile.type.startsWith('image/') ? '🖼️' : '📄'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedFile.name}
                          </strong>
                          <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                            {formatFileSize(selectedFile.size)} · {selectedFile.type || 'Dekont'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Değiştir
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ padding: '4px 8px', fontSize: '0.76rem', color: 'var(--color-danger)' }}
                          onClick={() => handleSelectFile(null)}
                        >
                          Kaldır
                        </button>
                      </div>
                    </div>

                    {/* Local image preview if image */}
                    {filePreviewUrl && (
                      <div style={{ marginTop: '10px', textAlign: 'center', background: 'var(--color-surface)', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                        <img
                          src={filePreviewUrl}
                          alt="Dekont Önizleme"
                          style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="confirmation-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? 'Gönderiliyor...' : 'Ödeme Bildirimi Gönder'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Charge Detail Drawer */}
      {drawerAnimation.shouldRender && detailCharge && (
        <>
          <button
            className={`drawer-backdrop drawer-${drawerAnimation.phase}`}
            type="button"
            aria-label="Kapat"
            disabled={drawerAnimation.isClosing}
            onClick={() => setIsDetailDrawerOpen(false)}
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className={`management-drawer drawer-${drawerAnimation.phase}`}
            role="dialog"
            aria-modal="true"
            style={{ width: 'min(520px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Borç Detayı</p>
                <h2>{detailCharge.title}</h2>
                <p className="drawer-description">{detailCharge.propertyName} · {detailCharge.buildingName} · No: {detailCharge.unitNumber}</p>
              </div>
              <button className="drawer-close-button" type="button" onClick={() => setIsDetailDrawerOpen(false)}>×</button>
            </div>

            <div className="drawer-form" style={{ gap: '14px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', background: 'var(--color-surface-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Borç Türü</span>
                  <span style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatChargeTypeLabel(detailCharge.chargeType)}</span>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Borç Durumu</span>
                  {detailCharge.status === 'PAID' ? (
                    <span className="status-badge active">Ödendi</span>
                  ) : detailCharge.status === 'PARTIALLY_PAID' ? (
                    <span className="status-badge info">Kısmi Ödendi</span>
                  ) : detailCharge.status === 'OVERDUE' ? (
                    <span className="status-badge danger">Gecikmiş</span>
                  ) : detailCharge.status === 'CANCELLED' ? (
                    <span className="status-badge inactive">İptal Edildi</span>
                  ) : (
                    <span className="status-badge warning">Bekliyor</span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Toplam Borç Tutarı</span>
                  <strong style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{formatCurrency(detailCharge.amount)}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Kalan Borç Tutarı</span>
                  <strong style={{ fontSize: '1.1rem', fontWeight: 800, color: detailCharge.remainingAmount > 0 ? 'var(--color-primary)' : 'var(--color-success)' }}>
                    {formatCurrency(detailCharge.remainingAmount)}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Ödenen Tutar</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-success)', fontWeight: 700 }}>{formatCurrency(detailCharge.paidAmount)}</span>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Son Ödeme Tarihi</span>
                  <span style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatDateOnly(detailCharge.dueDate)}</span>
                </div>
              </div>

              {detailCharge.description && (
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Açıklama</span>
                  <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--color-text-secondary)', background: 'var(--color-surface-secondary)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                    {detailCharge.description}
                  </p>
                </div>
              )}

              {detailCharge.remainingAmount > 0 && !detailCharge.isCancelled && (
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setIsDetailDrawerOpen(false)
                      handleOpenSubmitModal(detailCharge)
                    }}
                  >
                    Ödeme Bildirimi Oluştur
                  </button>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Cancel Submission Confirmation Dialog */}
      {cancelTargetSubmission && (
        <div className="confirmation-overlay" role="presentation">
          <div className="confirmation-dialog" style={{ maxWidth: '440px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
              Ödeme Bildirimini İptal Et
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: '0.84rem', color: 'var(--color-text-secondary)' }}>
              "{cancelTargetSubmission.unitChargeTitle}" için ilettiğiniz {formatCurrency(cancelTargetSubmission.amount)} tutarındaki ödeme bildirimini iptal etmek istediğinize emin misiniz?
            </p>

            <div className="confirmation-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCancelTargetSubmission(null)}
                disabled={isCancelling}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="action-button danger-btn"
                onClick={() => { void handleConfirmCancelSubmission() }}
                disabled={isCancelling}
              >
                <span>{isCancelling ? 'İptal Ediliyor...' : 'Evet, İptal Et'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
