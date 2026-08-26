import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  approvePaymentSubmission,
  getBuildingsByProperty,
  getManagementPaymentSubmissions,
  getPaymentSubmissionReceiptFile,
  getProperties,
  rejectPaymentSubmission,
} from '../api'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { LoadingSkeleton } from './LoadingSkeleton'
import { RowActionsMenu } from './RowActionsMenu'
import type {
  ApprovePaymentSubmissionPayload,
  Building,
  PaymentSubmission,
  Property,
  RejectPaymentSubmissionPayload,
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

const PAYMENT_METHOD_MAP: Record<string, string> = {
  BANK_TRANSFER: 'Banka Havalesi / EFT',
  BANK: 'Banka Havalesi / EFT',
  BANKTRANSFER: 'Banka Havalesi / EFT',
  HAVALE: 'Banka Havalesi / EFT',
  EFT: 'Banka Havalesi / EFT',
  CREDIT_CARD: 'Kredi Kartı',
  CARD: 'Kredi Kartı',
  CREDITCARD: 'Kredi Kartı',
  CASH: 'Nakit',
  NAKIT: 'Nakit',
  MANUAL: 'Elden / Manuel',
  ONLINE: 'Online Ödeme',
  OTHER: 'Diğer',
}

function formatPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Belirtilmedi'
  const key = method.trim().toUpperCase().replace(/[\s-]/g, '_')
  return PAYMENT_METHOD_MAP[key] || method
}

export function PaymentSubmissionsManagement() {
  const { showToast } = useToast()

  // Main list & loading state
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  // Lookups
  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [buildingFilter, setBuildingFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Detail Drawer state
  const [selectedSubmission, setSelectedSubmission] = useState<PaymentSubmission | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const drawerAnimation = useAnimatedDrawer(isDrawerOpen)
  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.shouldRender && !drawerAnimation.isClosing,
    onClose: () => setIsDrawerOpen(false),
  })

  // Secure Receipt state
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptError, setReceiptError] = useState('')
  const [receiptObjectUrl, setReceiptObjectUrl] = useState<string | null>(null)
  const [receiptContentType, setReceiptContentType] = useState<string>('')
  const [receiptFileName, setReceiptFileName] = useState<string>('')

  // Approve Modal state
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [approveTxRef, setApproveTxRef] = useState('')
  const [approveNotes, setApproveNotes] = useState('')
  const [approveError, setApproveError] = useState('')
  const [isApproving, setIsApproving] = useState(false)

  // Reject Modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)

  // Load properties lookup on mount
  useEffect(() => {
    async function loadProperties() {
      try {
        const data = await getProperties()
        setProperties(data)
      } catch (err) {
        // Handled silently
      }
    }
    void loadProperties()
  }, [])

  // Load buildings when property filter changes
  useEffect(() => {
    async function loadFilterBuildings() {
      if (propertyFilter === 'all') {
        setBuildings([])
        setBuildingFilter('all')
        return
      }
      try {
        const data = await getBuildingsByProperty(Number(propertyFilter))
        setBuildings(data)
      } catch (err) {
        setBuildings([])
      }
    }
    void loadFilterBuildings()
  }, [propertyFilter])

  // Load Payment Submissions list
  const loadSubmissionsList = useCallback(async () => {
    setIsLoading(true)
    setListError('')
    try {
      const st = statusFilter !== 'all' ? statusFilter : undefined
      const pId = propertyFilter !== 'all' ? Number(propertyFilter) : undefined
      const bId = buildingFilter !== 'all' ? Number(buildingFilter) : undefined

      const data = await getManagementPaymentSubmissions({
        status: st,
        propertyId: pId,
        buildingId: bId,
      })
      setSubmissions(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ödeme başvuruları yüklenemedi.'
      setListError(msg)
      showToast(msg)
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, propertyFilter, buildingFilter, showToast])

  useEffect(() => {
    void loadSubmissionsList()
  }, [loadSubmissionsList])

  // Filter list by searchQuery
  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return submissions
    const q = searchQuery.toLowerCase()
    return submissions.filter(
      (s) =>
        s.submittedByFullName.toLowerCase().includes(q) ||
        s.unitNumber.toLowerCase().includes(q) ||
        s.buildingName.toLowerCase().includes(q) ||
        s.propertyName.toLowerCase().includes(q) ||
        (s.referenceCode && s.referenceCode.toLowerCase().includes(q)) ||
        (s.unitChargeTitle && s.unitChargeTitle.toLowerCase().includes(q))
    )
  }, [submissions, searchQuery])

  // Open Detail Drawer and fetch secure receipt
  const handleOpenDetailDrawer = (item: PaymentSubmission) => {
    setSelectedSubmission(item)
    setIsDrawerOpen(true)
    setIsApproveModalOpen(false)
    setIsRejectModalOpen(false)
  }

  // Effect to fetch secure receipt file when drawer opens
  useEffect(() => {
    if (!selectedSubmission || !isDrawerOpen) {
      if (receiptObjectUrl) {
        URL.revokeObjectURL(receiptObjectUrl)
        setReceiptObjectUrl(null)
      }
      return
    }

    let active = true
    setReceiptLoading(true)
    setReceiptError('')

    async function loadReceipt() {
      try {
        const { blob, fileName, contentType } = await getPaymentSubmissionReceiptFile(selectedSubmission!.id)
        if (!active) return
        const objUrl = URL.createObjectURL(blob)
        setReceiptObjectUrl(objUrl)
        setReceiptContentType(contentType)
        setReceiptFileName(fileName)
      } catch (err) {
        if (!active) return
        setReceiptError('Dekont dosyası yüklenemedi veya erişilemiyor.')
      } finally {
        if (active) setReceiptLoading(false)
      }
    }

    void loadReceipt()

    return () => {
      active = false
    }
  }, [selectedSubmission, isDrawerOpen])

  // Cleanup object URL when component unmounts
  useEffect(() => {
    return () => {
      if (receiptObjectUrl) {
        URL.revokeObjectURL(receiptObjectUrl)
      }
    }
  }, [receiptObjectUrl])

  // Handle Approve Submission
  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubmission) return
    setApproveError('')

    setIsApproving(true)
    try {
      const payload: ApprovePaymentSubmissionPayload = {
        transactionReference: approveTxRef.trim() || null,
        notes: approveNotes.trim() || null,
      }
      const updated = await approvePaymentSubmission(selectedSubmission.id, payload)
      showToast('Ödeme başvurusu onaylandı.')
      setIsApproveModalOpen(false)
      setSelectedSubmission(updated)
      void loadSubmissionsList()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ödeme başvurusu onaylanamadı.'
      setApproveError(msg)
      showToast(msg)
    } finally {
      setIsApproving(false)
    }
  }

  // Handle Reject Submission
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubmission) return
    setRejectError('')

    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      setRejectError('Red gerekçesi en az 3 karakter olmalıdır.')
      return
    }

    setIsRejecting(true)
    try {
      const payload: RejectPaymentSubmissionPayload = {
        rejectionReason: rejectReason.trim(),
      }
      const updated = await rejectPaymentSubmission(selectedSubmission.id, payload)
      showToast('Ödeme başvurusu reddedildi.')
      setIsRejectModalOpen(false)
      setSelectedSubmission(updated)
      void loadSubmissionsList()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ödeme başvurusu reddedilemedi.'
      setRejectError(msg)
      showToast(msg)
    } finally {
      setIsRejecting(false)
    }
  }

  const activeFilterCount = [statusFilter !== 'all', propertyFilter !== 'all', buildingFilter !== 'all', Boolean(searchQuery.trim())].filter(Boolean).length

  return (
    <div className="section-container entity-management-view">
      {/* Standard Entity Page Actions Header */}
      <div className="entity-page-actions">
        <p>{!isLoading && !listError ? `${filteredSubmissions.length} ödeme başvurusu gösteriliyor.` : 'Sakinlerden gelen ödeme bildirimlerini inceleyin ve sonuçlandırın.'}</p>
      </div>

      {/* Standard Entity Toolbar */}
      <section className="panel entity-toolbar exp-toolbar" aria-label="Ödeme başvurusu filtreleri">
        <div className="form-field">
          <label htmlFor="pay-status-filter">Durum</label>
          <select
            id="pay-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="PENDING">Bekliyor (İnceleme)</option>
            <option value="APPROVED">Onaylandı</option>
            <option value="REJECTED">Reddedildi</option>
            <option value="CANCELLED">İptal Edildi</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="pay-prop-filter">Gayrimenkul</label>
          <select
            id="pay-prop-filter"
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
          >
            <option value="all">Tüm Gayrimenkuller</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id.toString()}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="pay-bldg-filter">Blok</label>
          <select
            id="pay-bldg-filter"
            value={buildingFilter}
            disabled={propertyFilter === 'all'}
            onChange={(e) => setBuildingFilter(e.target.value)}
          >
            <option value="all">Tüm Bloklar</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id.toString()}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="form-field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="pay-search-input">Arama</label>
          <input
            id="pay-search-input"
            type="text"
            placeholder="Başvuran, daire no, ref kodu, borç kalemi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          type="button"
          className={`secondary-button entity-filter-clear ${activeFilterCount > 0 ? 'has-active-filters' : ''}`}
          disabled={activeFilterCount === 0}
          onClick={() => { setStatusFilter('all'); setPropertyFilter('all'); setBuildingFilter('all'); setSearchQuery('') }}
        >
          <span>Filtreleri Temizle</span>
          {activeFilterCount > 0 && <span className="filter-count-badge" aria-label={`${activeFilterCount} aktif filtre`}>{activeFilterCount}</span>}
        </button>
      </section>

      {/* Main Content: Standardized Management Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : listError ? (
        <div className="panel status-message error-message">
          <p>{listError}</p>
          <button type="button" className="secondary-button" style={{ marginTop: '8px' }} onClick={() => { void loadSubmissionsList() }}>
            Tekrar Dene
          </button>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="panel status-message" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Kayıtlı ödeme başvurusu bulunamadı.</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
            Filtrelerinizi değiştirebilir veya arama terimini güncelleyebilirsiniz.
          </p>
        </div>
      ) : (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Daire</th>
                  <th>Başvuran Sakin</th>
                  <th className="text-right">Tutar</th>
                  <th>Ödeme Tarihi</th>
                  <th>Yöntem</th>
                  <th>Referans Kodu</th>
                  <th style={{ textAlign: 'center' }}>Durum</th>
                  <th className="text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                        No: {item.unitNumber}
                      </strong>
                      <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {item.propertyName} · {item.buildingName}
                      </div>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)' }}>
                        {item.submittedByFullName}
                      </strong>
                    </td>
                    <td className="text-right" style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary)' }}>
                      {formatCurrency(item.amount)}
                    </td>
                    <td>
                      <span>{formatDateOnly(item.paymentDate)}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                        {formatPaymentMethodLabel(item.paymentMethod)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
                        {item.referenceCode || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="due-status-wrapper">
                        {item.status === 'PENDING' ? (
                          <span className="status-badge warning">
                            Bekliyor
                          </span>
                        ) : item.status === 'APPROVED' ? (
                          <span className="status-badge active">
                            Onaylandı
                          </span>
                        ) : item.status === 'REJECTED' ? (
                          <span className="status-badge danger">
                            Reddedildi
                          </span>
                        ) : (
                          <span className="status-badge inactive">
                            İptal Edildi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      {item.status === 'PENDING' ? (
                        <RowActionsMenu label={`${item.submittedByFullName} ödeme başvurusu`} primaryAction={{ label: 'İncele', variant: 'primary', onSelect: () => handleOpenDetailDrawer(item) }} />
                      ) : (
                        <RowActionsMenu label={`${item.submittedByFullName} ödeme başvurusu`} primaryAction={{ label: 'Detay', onSelect: () => handleOpenDetailDrawer(item) }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Detail Drawer */}
      {drawerAnimation.shouldRender && selectedSubmission && (
        <>
          <button
            className={`drawer-backdrop drawer-${drawerAnimation.phase}`}
            type="button"
            aria-label="Kapat"
            disabled={drawerAnimation.isClosing}
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className={`management-drawer payment-submission-drawer drawer-${drawerAnimation.phase}`}
            role="dialog"
            aria-modal="true"
            style={{ width: 'min(580px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Ödeme Yönetimi</p>
                <h2>Ödeme Başvurusu Detayı</h2>
                <p className="drawer-description">Sakin tarafından iletilen ödeme bildirimi ve dekont bilgileri.</p>
              </div>
              <button className="drawer-close-button" type="button" onClick={() => setIsDrawerOpen(false)}>×</button>
            </div>

            <div className="drawer-body">
              {/* Status Banner */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: '8px',
                background: selectedSubmission.status === 'APPROVED' ? 'var(--color-success-soft)' : selectedSubmission.status === 'PENDING' ? 'var(--color-warning-soft)' : 'var(--color-surface-secondary)',
                border: '1px solid var(--color-border)'
              }}>
                <div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', display: 'block' }}>Başvuru Durumu</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                    {selectedSubmission.status === 'PENDING' ? 'İnceleme Bekliyor' : selectedSubmission.status === 'APPROVED' ? 'Onaylandı' : selectedSubmission.status === 'REJECTED' ? 'Reddedildi' : 'İptal Edildi'}
                  </strong>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                  {formatDate(selectedSubmission.createdAt)}
                </div>
              </div>

              {/* Information Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', background: 'var(--color-surface-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Daire / Konum</span>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)' }}>{selectedSubmission.propertyName}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{selectedSubmission.buildingName} · No: {selectedSubmission.unitNumber}</div>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Başvuran Sakin</span>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)' }}>{selectedSubmission.submittedByFullName}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Bildirilen Tutar</span>
                  <strong style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)' }}>{formatCurrency(selectedSubmission.amount)}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Ödeme Tarihi</span>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)' }}>{formatDateOnly(selectedSubmission.paymentDate)}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Ödeme Yöntemi</span>
                  <span style={{ fontSize: '0.84rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatPaymentMethodLabel(selectedSubmission.paymentMethod)}</span>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Referans / Dekont No</span>
                  <span style={{ fontSize: '0.84rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{selectedSubmission.referenceCode || '—'}</span>
                </div>
              </div>

              {/* Charge Item Title */}
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', display: 'block' }}>İlgili Borç Kalemi</span>
                <span style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{selectedSubmission.unitChargeTitle}</span>
              </div>

              {/* User Notes */}
              {selectedSubmission.userNotes && (
                <div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', display: 'block' }}>Sakin Açıklaması / Notu</span>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)', background: 'var(--color-surface-secondary)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                    {selectedSubmission.userNotes}
                  </p>
                </div>
              )}

              {/* Review Information (If already reviewed) */}
              {selectedSubmission.reviewedByFullName && (
                <div style={{ background: 'var(--color-surface-secondary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>İnceleyen Yönetici Bilgisi</span>
                  <div style={{ fontSize: '0.84rem', color: 'var(--color-text-primary)', fontWeight: 600, marginTop: '2px' }}>
                    {selectedSubmission.reviewedByFullName} · {formatDate(selectedSubmission.reviewedAt)}
                  </div>
                  {selectedSubmission.rejectionReason && (
                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--color-danger)', borderTop: '1px solid var(--color-border)', paddingTop: '6px' }}>
                      <strong>Red Gerekçesi:</strong> {selectedSubmission.rejectionReason}
                    </div>
                  )}
                </div>
              )}

              {/* Secure Receipt Preview Box */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', marginTop: '4px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                  Yüklenen Dekont Belgesi
                </h4>

                {receiptLoading ? (
                  <LoadingSkeleton variant="detail" rows={3} />
                ) : receiptError ? (
                  <div className="status-message error-message" style={{ fontSize: '0.8rem' }}>
                    {receiptError}
                  </div>
                ) : receiptObjectUrl ? (
                  <div>
                    {receiptContentType.startsWith('image/') ? (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--color-surface-secondary)', borderRadius: '8px', padding: '12px', border: '1px solid var(--color-border)', maxHeight: '340px', overflow: 'hidden' }}>
                        <img
                          src={receiptObjectUrl}
                          alt="Dekont Belgesi"
                          style={{ maxHeight: '316px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                        />
                      </div>
                    ) : receiptContentType.includes('pdf') ? (
                      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface-secondary)' }}>
                        <iframe
                          src={receiptObjectUrl}
                          title="Dekont PDF Önizleme"
                          style={{ width: '100%', height: '300px', border: '0', display: 'block' }}
                        />
                      </div>
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center', background: 'var(--color-surface-secondary)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>📁</div>
                        <p style={{ margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{receiptFileName}</p>
                        <small style={{ color: 'var(--color-text-secondary)' }}>Önizleme bu dosya türü için desteklenmiyor.</small>
                      </div>
                    )}

                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <a
                        href={receiptObjectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="secondary-button"
                        style={{ fontSize: '0.78rem', padding: '6px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>↗ Yeni Sekmede Aç</span>
                      </a>
                      <a
                        href={receiptObjectUrl}
                        download={receiptFileName}
                        className="secondary-button"
                        style={{ fontSize: '0.78rem', padding: '6px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>↓ İndir ({receiptFileName})</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Bu başvuruya ait yüklü dekont belgesi bulunmamaktadır.
                  </p>
                )}
              </div>
            </div>

            {/* Separate Fixed Footer Section (Visible when status === 'PENDING') */}
            {selectedSubmission.status === 'PENDING' && (
              <div className="drawer-footer">
                <button
                  type="button"
                  className="action-button danger-btn"
                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                  onClick={() => {
                    setRejectReason('')
                    setRejectError('')
                    setIsRejectModalOpen(true)
                  }}
                >
                  Reddet
                </button>
                <button
                  type="button"
                  className="primary-button"
                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                  onClick={() => {
                    setApproveTxRef('')
                    setApproveNotes('')
                    setApproveError('')
                    setIsApproveModalOpen(true)
                  }}
                >
                  Onayla
                </button>
              </div>
            )}
          </aside>
        </>
      )}

      {/* Approve Confirmation Modal */}
      {isApproveModalOpen && selectedSubmission && (
        <div className="confirmation-overlay" role="presentation">
          <div className="confirmation-dialog" style={{ maxWidth: '460px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
              Ödeme Başvurusunu Onayla
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              "{selectedSubmission.submittedByFullName}" sakininin {formatCurrency(selectedSubmission.amount)} tutarındaki ödemesini onaylamak üzeresiniz.
            </p>

            <form onSubmit={(e) => { void handleApproveSubmit(e) }}>
              {approveError && (
                <div className="status-message error-message" style={{ marginBottom: '12px' }}>
                  {approveError}
                </div>
              )}

              <div className="form-field" style={{ marginBottom: '12px' }}>
                <label htmlFor="approve-tx-ref">İşlem / Banka Referansı (Opsiyonel)</label>
                <input
                  id="approve-tx-ref"
                  type="text"
                  maxLength={100}
                  placeholder="Örn: BANK-REF-9982"
                  value={approveTxRef}
                  onChange={(e) => setApproveTxRef(e.target.value)}
                />
              </div>

              <div className="form-field" style={{ marginBottom: '20px' }}>
                <label htmlFor="approve-notes">Yönetici Notu (Opsiyonel)</label>
                <textarea
                  id="approve-notes"
                  rows={2}
                  maxLength={500}
                  placeholder="İsteğe bağlı açıklama notu..."
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                />
              </div>

              <div className="confirmation-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsApproveModalOpen(false)}
                  disabled={isApproving}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isApproving}
                >
                  <span>{isApproving ? 'Onaylanıyor...' : 'Onayla'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {isRejectModalOpen && selectedSubmission && (
        <div className="confirmation-overlay" role="presentation">
          <div className="confirmation-dialog" style={{ maxWidth: '460px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
              Ödeme Başvurusunu Reddet
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              "{selectedSubmission.submittedByFullName}" sakininin {formatCurrency(selectedSubmission.amount)} tutarındaki ödemesini reddetmek üzeresiniz.
            </p>

            <form onSubmit={(e) => { void handleRejectSubmit(e) }}>
              {rejectError && (
                <div className="status-message error-message" style={{ marginBottom: '12px' }}>
                  {rejectError}
                </div>
              )}

              <div className="form-field" style={{ marginBottom: '20px' }}>
                <label htmlFor="reject-reason">Red Gerekçesi *</label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  maxLength={500}
                  placeholder="Red gerekçesini sakine açıklayın (ör: Dekont üzerindeki tutar veya hesap numarası uyuşmuyor)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
              </div>

              <div className="confirmation-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={isRejecting}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="action-button danger-btn"
                  disabled={isRejecting}
                >
                  <span>{isRejecting ? 'Reddediliyor...' : 'Reddet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
