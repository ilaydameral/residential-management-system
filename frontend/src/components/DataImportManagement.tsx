import { useCallback, useEffect, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  confirmImportBatch,
  exportImportErrorsCsv,
  getImportBatches,
  getImportColumnOptions,
  getImportPreview,
  rollbackImportBatch,
  uploadImportFile,
  validateImportBatch,
} from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import type {
  ImportBatch,
  ImportColumnMappingOptions,
  ImportPreviewResponse,
  ImportReconciliation,
} from '../types'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'

type ActiveTab = 'new-import' | 'history'
type ImportStep = 1 | 2 | 3 | 4 | 5

const IMPORT_TYPE_OPTIONS: Array<{
  key: string
  label: string
  description: string
  adminOnly?: boolean
}> = [
  { key: 'PROPERTIES', label: 'Siteler / Taşınmazlar', description: 'Site ve apartman ana kayıtları', adminOnly: true },
  { key: 'BUILDINGS', label: 'Bloklar / Binalar', description: 'Taşınmazlara bağlı blok kayıtları' },
  { key: 'UNITS', label: 'Daireler / Bağımsız Bölümler', description: 'Bloklara bağlı daireler' },
  { key: 'USERS', label: 'Kullanıcılar / Sakinler', description: 'Sistem sakinleri (Varsayılan Sakin rolü ile)' },
  { key: 'OCCUPANCIES', label: 'İkamet İlişkileri', description: 'Daire-sakin ikamet eşleşmeleri' },
]

const ERROR_CODE_LABELS: Record<string, string> = {
  REQUIRED_FIELD: 'Zorunlu Alan Eksik',
  INVALID_FORMAT: 'Geçersiz Format',
  DUPLICATE: 'Mükerrer Kayıt',
  FORBIDDEN_SCOPE: 'Yetki Dışı',
  REFERENCE_NOT_FOUND: 'İlişkili Kayıt Bulunamadı',
  INVALID_VALUE: 'Geçersiz Değer',
  UNSUPPORTED_IMPORT_TYPE: 'Desteklenmeyen Tür',
}

const STATUS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  UPLOADED: { label: 'Yüklendi', className: 'status-badge pending' },
  VALIDATED: { label: 'Doğrulandı', className: 'status-badge warning' },
  READY: { label: 'Hazır', className: 'status-badge active' },
  IMPORTING: { label: 'Aktarılıyor', className: 'status-badge info' },
  COMPLETED: { label: 'Tamamlandı', className: 'status-badge success' },
  FAILED: { label: 'Başarısız', className: 'status-badge cancelled' },
  ROLLED_BACK: { label: 'Geri Alındı', className: 'status-badge secondary' },
}

export function DataImportManagement() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const isAdmin = user?.roles?.includes('ADMIN') ?? false

  const [activeTab, setActiveTab] = useState<ActiveTab>('new-import')

  // Step 1 State
  const [currentStep, setCurrentStep] = useState<ImportStep>(1)
  const [selectedType, setSelectedType] = useState<string>('')

  // Step 2 State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [uploadedBatch, setUploadedBatch] = useState<ImportBatch | null>(null)

  // Step 3 State
  const [mappingOptions, setMappingOptions] = useState<ImportColumnMappingOptions | null>(null)
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({})
  const [isLoadingColumns, setIsLoadingColumns] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [mappingError, setMappingError] = useState<string | null>(null)

  // Step 4 Preview State
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null)
  const [previewFilter, setPreviewFilter] = useState<string>('all')
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Step 5 Result State
  const [reconciliationResult, setReconciliationResult] = useState<ImportReconciliation | null>(null)

  // History Tab State
  const [historyItems, setHistoryItems] = useState<ImportBatch[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all')
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // History Detail Drawer State
  const [selectedHistoryBatch, setSelectedHistoryBatch] = useState<ImportBatch | null>(null)

  // Rollback Modal State
  const [showRollbackModal, setShowRollbackModal] = useState(false)
  const [isRollingBack, setIsRollingBack] = useState(false)

  const drawerAnimation = useAnimatedDrawer(Boolean(selectedHistoryBatch))
  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.shouldRender,
    onClose: () => handleCloseHistoryDrawer(),
  })

  // Load History Batches
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const res = await getImportBatches({
        importType: historyTypeFilter !== 'all' ? historyTypeFilter : undefined,
        status: historyStatusFilter !== 'all' ? historyStatusFilter : undefined,
        page: historyPage,
        pageSize: 15,
      })
      setHistoryItems(res.items)
      setHistoryTotal(res.totalCount)
    } catch (err: any) {
      showToast(err.message || 'Aktarım geçmişi yüklenirken hata oluştu.')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [historyTypeFilter, historyStatusFilter, historyPage, showToast])

  useEffect(() => {
    if (activeTab === 'history') {
      void loadHistory()
    }
  }, [activeTab, loadHistory])

  // Drag & Drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      validateAndSetFile(file)
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv' && ext !== 'xlsx') {
      showToast('Yalnızca .csv ve .xlsx uzantılı dosyalar desteklenmektedir.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('Dosya boyutu 20 MB sınırını aşamaz.')
      return
    }
    setSelectedFile(file)
  }

  // Upload file and move to Step 3
  const handleUploadFile = async () => {
    if (!selectedFile || !selectedType) return
    setIsUploading(true)
    setDuplicateWarning(null)
    try {
      const res = await uploadImportFile(selectedType, selectedFile)
      setUploadedBatch(res.batch)

      if (res.isDuplicateUpload && res.duplicateWarning) {
        setDuplicateWarning(res.duplicateWarning)
      }

      // Load column mapping options
      setIsLoadingColumns(true)
      const colRes = await getImportColumnOptions(res.batch.id)
      setMappingOptions(colRes)
      setColumnMappings(colRes.suggestedMappings || {})
      setCurrentStep(3)
    } catch (err: any) {
      showToast(err.message || 'Dosya yüklenirken hata oluştu.')
    } finally {
      setIsUploading(false)
      setIsLoadingColumns(false)
    }
  }

  // Validate mappings and move to Step 4
  const handleValidateMappings = async () => {
    if (!uploadedBatch || !mappingOptions) return

    // Check required fields
    const missingRequired = mappingOptions.allowedTargetFields
      .filter((f) => f.isRequired && !Object.values(columnMappings).includes(f.key))
      .map((f) => f.label)

    if (missingRequired.length > 0) {
      setMappingError(`Zorunlu alanlar eşlenmemiş: ${missingRequired.join(', ')}.`)
      return
    }

    setMappingError(null)
    setIsValidating(true)
    try {
      const valRes = await validateImportBatch(uploadedBatch.id, { columnMappings })
      setPreviewData(valRes)
      setUploadedBatch(valRes.summary)
      setCurrentStep(4)
    } catch (err: any) {
      showToast(err.message || 'Doğrulama esnasında hata oluştu.')
    } finally {
      setIsValidating(false)
    }
  }

  // Handle Preview Action Filter & Page change
  const handlePreviewFilterChange = async (filter: string, page = 1) => {
    if (!uploadedBatch) return
    setPreviewFilter(filter)
    setIsLoadingPreview(true)
    try {
      const actionParam = filter !== 'all' ? filter : undefined
      const prevRes = await getImportPreview(uploadedBatch.id, actionParam, page, 50)
      setPreviewData(prevRes)
    } catch (err: any) {
      showToast(err.message || 'Önizleme verisi yüklenirken hata oluştu.')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Download Error CSV
  const handleDownloadErrorsCsv = async (batchId: number) => {
    try {
      const blob = await exportImportErrorsCsv(batchId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `import_errors_batch_${batchId}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showToast('Hata raporu indirildi.')
    } catch (err: any) {
      showToast(err.message || 'Hata raporu indirilemedi.')
    }
  }

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!uploadedBatch) return
    setIsConfirming(true)
    try {
      const res = await confirmImportBatch(uploadedBatch.id)
      setUploadedBatch(res.batch)
      setReconciliationResult(res.reconciliation)
      setShowConfirmModal(false)
      setCurrentStep(5)
      showToast('Veri aktarımı başarıyla tamamlandı!')
    } catch (err: any) {
      showToast(err.message || 'İçe aktarım esnasında hata oluştu.')
      setShowConfirmModal(false)
    } finally {
      setIsConfirming(false)
    }
  }

  // Reset for New Import
  const handleResetFlow = () => {
    setCurrentStep(1)
    setSelectedType('')
    setSelectedFile(null)
    setDuplicateWarning(null)
    setUploadedBatch(null)
    setMappingOptions(null)
    setColumnMappings({})
    setPreviewData(null)
    setPreviewFilter('all')
    setReconciliationResult(null)
  }

  // Open History Drawer
  const handleOpenHistoryDrawer = (batch: ImportBatch) => {
    setSelectedHistoryBatch(batch)
  }

  // Close History Drawer
  const handleCloseHistoryDrawer = () => {
    drawerAnimation.close(() => {
      setSelectedHistoryBatch(null)
    })
  }

  // Rollback Batch
  const handleExecuteRollback = async () => {
    if (!selectedHistoryBatch) return
    setIsRollingBack(true)
    try {
      const res = await rollbackImportBatch(selectedHistoryBatch.id)
      showToast(res.message || 'Parti başarıyla geri alındı.')
      setShowRollbackModal(false)
      handleCloseHistoryDrawer()
      void loadHistory()
    } catch (err: any) {
      showToast(err.message || 'Geri alma işlemi başarısız oldu.')
      setShowRollbackModal(false)
    } finally {
      setIsRollingBack(false)
    }
  }

  return (
    <div className="section-container entity-management-view">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Veri Aktarımı
          </h1>
          <p className="page-description">
            CSV ve XLSX dosyaları üzerinden toplu taşınmaz, blok, daire, kullanıcı ve ikamet kaydı aktarın.
          </p>
        </div>

        <div className="management-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={`secondary-button ${activeTab === 'new-import' ? 'active' : ''}`}
            onClick={() => setActiveTab('new-import')}
          >
            Yeni Aktarım
          </button>
          <button
            type="button"
            className={`secondary-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Aktarım Geçmişi ({historyTotal})
          </button>
        </div>
      </div>

      {activeTab === 'new-import' && (
        <div className="panel" style={{ padding: '1.5rem' }}>
          {/* Step Indicator */}
          <div
            className="import-step-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '2rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '1rem',
            }}
          >
            {[
              { step: 1, label: '1. Veri Türü' },
              { step: 2, label: '2. Dosya Seçimi' },
              { step: 3, label: '3. Sütun Eşleme' },
              { step: 4, label: '4. Önizleme & Doğrulama' },
              { step: 5, label: '5. Tamamlandı' },
            ].map((s) => (
              <div
                key={s.step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: currentStep >= s.step ? 'var(--primary-color)' : 'var(--text-muted)',
                  fontWeight: currentStep === s.step ? '600' : '400',
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: currentStep >= s.step ? 'var(--primary-color)' : 'var(--border-color)',
                    color: currentStep >= s.step ? '#fff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                  }}
                >
                  {s.step}
                </span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          {/* STEP 1: Veri Türü Seçimi */}
          {currentStep === 1 && (
            <div>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Aktarılacak Veri Türünü Seçin</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {IMPORT_TYPE_OPTIONS.map((opt) => {
                  const isDisabled = Boolean(opt.adminOnly && !isAdmin)
                  const isSelected = selectedType === opt.key

                  return (
                    <div
                      key={opt.key}
                      onClick={() => {
                        if (!isDisabled) setSelectedType(opt.key)
                      }}
                      style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                        background: isDisabled ? 'var(--bg-hover)' : isSelected ? 'var(--primary-light-bg, rgba(59, 130, 246, 0.05))' : 'var(--bg-card)',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.6 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '1rem' }}>{opt.label}</strong>
                        {opt.adminOnly && !isAdmin && (
                          <span className="status-badge warning" style={{ fontSize: '0.7rem' }}>
                            ADMIN-only
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{opt.description}</p>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!selectedType}
                  onClick={() => setCurrentStep(2)}
                >
                  Devam Et →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Dosya Yükleme */}
          {currentStep === 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Dosya Yükleme ({IMPORT_TYPE_OPTIONS.find((t) => t.key === selectedType)?.label})</h2>
                <button type="button" className="secondary-button" onClick={() => setCurrentStep(1)}>
                  ← Tür Değiştir
                </button>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragOver ? '2px dashed var(--primary-color)' : '2px dashed var(--border-color)',
                  background: isDragOver ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-hover)',
                  borderRadius: '8px',
                  padding: '2.5rem',
                  textAlign: 'center',
                  marginBottom: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', color: 'var(--text-muted)' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>

                <p style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                  Dosyayı buraya sürükleyip bırakın veya seçin
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Desteklenen Formatlar: <strong>.CSV</strong> veya <strong>.XLSX</strong> (Maksimum 20 MB)
                </p>

                <input
                  type="file"
                  id="file-upload-input"
                  accept=".csv, .xlsx"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <label htmlFor="file-upload-input" className="secondary-button" style={{ cursor: 'pointer', display: 'inline-block' }}>
                  Dosya Seç
                </label>
              </div>

              {selectedFile && (
                <div className="panel" style={{ padding: '1rem', marginBottom: '1.5rem', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong>{selectedFile.name}</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB | Format: {selectedFile.name.split('.').pop()?.toUpperCase()}
                      </div>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => setSelectedFile(null)}>
                      Kaldır
                    </button>
                  </div>
                </div>
              )}

              {duplicateWarning && (
                <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', marginBottom: '1.5rem', color: '#b45309' }}>
                  <strong>Mükerrer Yükleme Uyarısı:</strong> {duplicateWarning}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!selectedFile || isUploading}
                  onClick={() => void handleUploadFile()}
                >
                  {isUploading ? 'Dosya Yükleniyor...' : 'Dosyayı Yükle ve Sütunları Eşle →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Sütun Eşleme */}
          {currentStep === 3 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Sütun Eşleme</h2>
                <span className="status-badge info">Parti ID: #{uploadedBatch?.id}</span>
              </div>

              {isLoadingColumns ? (
                <LoadingSkeleton variant="table" />
              ) : mappingOptions ? (
                <div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Dosyanızdaki kaynak sütunları sistemdeki hedef alanlarla eşleyin. Zorunlu alanlar (*) sembolü ile belirtilmiştir.
                  </p>

                  {mappingError && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', marginBottom: '1rem', color: '#dc2626' }}>
                      {mappingError}
                    </div>
                  )}

                  <div className="panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                    <table className="management-table">
                      <thead>
                        <tr>
                          <th>Dosya Sütunu (Kaynak)</th>
                          <th>Hedef Sistem Alanı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappingOptions.sourceHeaders.map((header) => (
                          <tr key={header}>
                            <td>
                              <strong>{header}</strong>
                            </td>
                            <td>
                              <select
                                className="mapping-select-control"
                                value={columnMappings[header] || ''}
                                onChange={(e) => {
                                  setColumnMappings({
                                    ...columnMappings,
                                    [header]: e.target.value,
                                  })
                                }}
                                style={{
                                  width: '100%',
                                  maxWidth: '400px',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-card)',
                                  color: 'var(--text-main)',
                                  fontSize: '0.9rem',
                                }}
                              >
                                <option value="">-- Eşleme Yok --</option>
                                {mappingOptions.allowedTargetFields.map((field) => (
                                  <option key={field.key} value={field.key}>
                                    {field.label} {field.isRequired ? ' (* Zorunlu)' : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={isValidating}
                      onClick={() => void handleValidateMappings()}
                    >
                      {isValidating ? 'Doğrulanıyor...' : 'Doğrula ve Önizle →'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* STEP 4: Önizleme & Kuru Çalışma */}
          {currentStep === 4 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Aktarım Önizlemesi & Doğrulama</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="secondary-button" onClick={() => setCurrentStep(3)}>
                    ← Eşlemeleri Düzenle
                  </button>
                </div>
              </div>

              {isLoadingPreview ? (
                <LoadingSkeleton variant="table" />
              ) : previewData ? (
                <div>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="panel" style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam Satır</span>
                      <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0 0' }}>{previewData.summary.totalRows}</h3>
                    </div>
                    <div className="panel" style={{ padding: '1rem', textAlign: 'center', borderColor: 'var(--primary-color)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Eklenecek</span>
                      <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0 0', color: '#16a34a' }}>{previewData.summary.validRows}</h3>
                    </div>
                    <div className="panel" style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Atlanan (Mükerrer)</span>
                      <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0 0', color: '#d97706' }}>{previewData.summary.skippedRows}</h3>
                    </div>
                    <div className="panel" style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hatalı Satır</span>
                      <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0 0', color: '#dc2626' }}>{previewData.summary.invalidRows}</h3>
                    </div>
                  </div>

                  {/* Warning / Error Banners */}
                  {previewData.summary.invalidRows > 0 && (
                    <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <strong style={{ color: '#dc2626' }}>Dosyada hatalı satırlar bulunmaktadır!</strong>
                        <p style={{ fontSize: '0.85rem', margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
                          Hatalar düzeltilmeden aktarım başlatılamaz. Hata raporunu indirip dosyanızı güncelleyebilirsiniz.
                        </p>
                      </div>
                      <button type="button" className="secondary-button" onClick={() => void handleDownloadErrorsCsv(previewData.summary.id)}>
                        Hataları CSV Olarak İndir
                      </button>
                    </div>
                  )}

                  {previewData.summary.invalidRows === 0 && previewData.summary.validRows === 0 && (
                    <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', marginBottom: '1.5rem', color: '#b45309' }}>
                      Aktarılacak yeni bir kayıt bulunmuyor (Tüm satırlar mükerrer olduğu için atlandı).
                    </div>
                  )}

                  {/* Filter Tabs */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {[
                      { key: 'all', label: 'Tümü' },
                      { key: 'CREATE', label: 'Eklenecek' },
                      { key: 'SKIP', label: 'Atlanacak' },
                      { key: 'ERROR', label: 'Hatalı' },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className={`secondary-button ${previewFilter === f.key ? 'active' : ''}`}
                        onClick={() => void handlePreviewFilterChange(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Preview Table */}
                  <div className="panel" style={{ padding: '1rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
                    <table className="management-table">
                      <thead>
                        <tr>
                          <th>Satır</th>
                          <th>İşlem</th>
                          <th>Durum</th>
                          <th>Veri Özeti</th>
                          <th>Hata / Açıklama</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              Filtreye uygun satır bulunamadı.
                            </td>
                          </tr>
                        ) : (
                          previewData.rows.map((row) => (
                            <tr key={row.id}>
                              <td>#{row.rowNumber}</td>
                              <td>
                                <span className={`status-badge ${row.actionPreview === 'CREATE' ? 'success' : row.actionPreview === 'SKIP' ? 'warning' : 'cancelled'}`}>
                                  {row.actionPreview === 'CREATE' ? 'Eklenecek' : row.actionPreview === 'SKIP' ? 'Atlanacak' : 'Hatalı'}
                                </span>
                              </td>
                              <td>
                                <span className="status-badge info">{row.status}</span>
                              </td>
                              <td>
                                <div style={{ fontSize: '0.85rem', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {Object.entries(row.rawData).slice(0, 3).map(([k, v]) => (
                                    <span key={k} style={{ marginRight: '0.75rem' }}>
                                      <strong style={{ color: 'var(--text-muted)' }}>{k}:</strong> {v}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                {row.validationErrors && row.validationErrors.length > 0 ? (
                                  <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>
                                    {row.validationErrors.map((err, i) => (
                                      <div key={i}>
                                        <strong>[{ERROR_CODE_LABELS[err.code] || err.code}]:</strong> {err.message}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: '#16a34a', fontSize: '0.85rem' }}>Sorunsuz</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={previewData.summary.status !== 'READY' || previewData.summary.validRows === 0}
                      onClick={() => setShowConfirmModal(true)}
                    >
                      Aktarımı Başlat ({previewData.summary.validRows} Kayıt)
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* STEP 5: Tamamlandı */}
          {currentStep === 5 && reconciliationResult && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.8rem' }}>
                ✓
              </div>

              <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Veri Aktarımı Tamamlandı!</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Parti #{uploadedBatch?.id} veritabanına başarıyla işlendi.
              </p>

              {/* Reconciliation Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', maxWidth: '700px', margin: '0 auto 2rem' }}>
                <div className="panel" style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aktarılmak İstenen</span>
                  <h3 style={{ fontSize: '1.3rem', margin: '0.25rem 0 0' }}>{reconciliationResult.attemptedCreateRows}</h3>
                </div>
                <div className="panel" style={{ padding: '1rem', borderColor: '#16a34a' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Başarıyla Eklenen</span>
                  <h3 style={{ fontSize: '1.3rem', margin: '0.25rem 0 0', color: '#16a34a' }}>{reconciliationResult.successfullyCreatedRows}</h3>
                </div>
                <div className="panel" style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Atlanan Kayıt</span>
                  <h3 style={{ fontSize: '1.3rem', margin: '0.25rem 0 0', color: '#d97706' }}>{reconciliationResult.skippedRows}</h3>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button type="button" className="secondary-button" onClick={handleResetFlow}>
                  Yeni Aktarım Başlat
                </button>
                <button type="button" className="primary-button" onClick={() => setActiveTab('history')}>
                  Aktarım Geçmişini İncele →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div>
          {/* Filters */}
          <div className="panel entity-toolbar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="form-field">
              <label htmlFor="history-type-filter">Veri Türü</label>
              <select
                id="history-type-filter"
                value={historyTypeFilter}
                onChange={(e) => {
                  setHistoryTypeFilter(e.target.value)
                  setHistoryPage(1)
                }}
              >
                <option value="all">Tüm Türler</option>
                {IMPORT_TYPE_OPTIONS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="history-status-filter">Durum</label>
              <select
                id="history-status-filter"
                value={historyStatusFilter}
                onChange={(e) => {
                  setHistoryStatusFilter(e.target.value)
                  setHistoryPage(1)
                }}
              >
                <option value="all">Tüm Statüler</option>
                <option value="UPLOADED">Yüklendi</option>
                <option value="VALIDATED">Doğrulandı</option>
                <option value="READY">Hazır</option>
                <option value="COMPLETED">Tamamlandı</option>
                <option value="FAILED">Başarısız</option>
                <option value="ROLLED_BACK">Geri Alındı</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {isLoadingHistory ? (
            <LoadingSkeleton variant="table" />
          ) : (
            <div className="panel" style={{ padding: '1rem', overflowX: 'auto' }}>
              <table className="management-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tarih</th>
                    <th>Dosya Adı</th>
                    <th>Veri Türü</th>
                    <th>Durum</th>
                    <th>Satır (Top / Ekl / Atl / Hat)</th>
                    <th>Oluşturan</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Kayıtlı aktarım geçmişi bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    historyItems.map((b) => {
                      const badgeInfo = STATUS_BADGE_MAP[b.status] || { label: b.status, className: 'status-badge' }
                      return (
                        <tr key={b.id}>
                          <td>#{b.id}</td>
                          <td>{new Date(b.createdAt).toLocaleString('tr-TR')}</td>
                          <td>
                            <strong>{b.originalFileName}</strong>
                          </td>
                          <td>{IMPORT_TYPE_OPTIONS.find((t) => t.key === b.importType)?.label || b.importType}</td>
                          <td>
                            <span className={badgeInfo.className}>{badgeInfo.label}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.85rem' }}>
                              {b.totalRows} / <span style={{ color: '#16a34a' }}>{b.importedRows}</span> / <span style={{ color: '#d97706' }}>{b.skippedRows}</span> / <span style={{ color: '#dc2626' }}>{b.invalidRows}</span>
                            </span>
                          </td>
                          <td>{b.createdByFullName || `Kullanıcı #${b.createdByUserId}`}</td>
                          <td>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => void handleOpenHistoryDrawer(b)}
                            >
                              Detaylar
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && uploadedBatch && (
        <ConfirmationDialog
          title="İçe Aktarımı Onayla"
          message={`Parti #${uploadedBatch.id} kapsamındaki ${uploadedBatch.validRows} adet geçerli kayıt veritabanına aktarılacaktır. Mevcut veriler güncellenmeyecektir. Onaylıyor musunuz?`}
          confirmLabel="Evet, Aktar"
          isLoading={isConfirming}
          onCancel={() => setShowConfirmModal(false)}
          onConfirm={() => void handleConfirmImport()}
        />
      )}

      {/* ROLLBACK CONFIRMATION MODAL */}
      {showRollbackModal && selectedHistoryBatch && (
        <ConfirmationDialog
          title="İçe Aktarımı Geri Al"
          message={`Parti #${selectedHistoryBatch.id} tarafından oluşturulmuş ${selectedHistoryBatch.importedRows} adet kayıt geri alınacaktır. Geri alma yalnızca sonradan başka kayıtlarla ilişkilendirilmemiş veriler için geçerlidir. Devam etmek istiyor musunuz?`}
          confirmLabel="Evet, Geri Al"
          danger
          isLoading={isRollingBack}
          onCancel={() => setShowRollbackModal(false)}
          onConfirm={() => void handleExecuteRollback()}
        />
      )}

      {/* HISTORY DETAIL DRAWER */}
      {drawerAnimation.shouldRender && selectedHistoryBatch && (
        <>
          <button
            className={`drawer-backdrop drawer-${drawerAnimation.phase}`}
            type="button"
            aria-label="Kapat"
            disabled={drawerAnimation.isClosing}
            onClick={handleCloseHistoryDrawer}
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className={`management-drawer drawer-${drawerAnimation.phase}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-drawer-title"
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Veri Aktarımı Geçmişi</p>
                <h2 id="history-drawer-title">Parti Detayları (#{selectedHistoryBatch.id})</h2>
              </div>
              <button type="button" className="close-button" onClick={handleCloseHistoryDrawer}>
                ✕
              </button>
            </div>

            <div className="drawer-body">
              <div className="panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Aktarım Bilgileri</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <div>
                    <strong>Dosya Adı:</strong> {selectedHistoryBatch.originalFileName}
                  </div>
                  <div>
                    <strong>Veri Türü:</strong>{' '}
                    {IMPORT_TYPE_OPTIONS.find((t) => t.key === selectedHistoryBatch.importType)?.label || selectedHistoryBatch.importType}
                  </div>
                  <div>
                    <strong>Durum:</strong>{' '}
                    <span className={STATUS_BADGE_MAP[selectedHistoryBatch.status]?.className || 'status-badge'}>
                      {STATUS_BADGE_MAP[selectedHistoryBatch.status]?.label || selectedHistoryBatch.status}
                    </span>
                  </div>
                  <div>
                    <strong>Oluşturan:</strong> {selectedHistoryBatch.createdByFullName || `Kullanıcı #${selectedHistoryBatch.createdByUserId}`}
                  </div>
                  <div>
                    <strong>Oluşturulma:</strong> {new Date(selectedHistoryBatch.createdAt).toLocaleString('tr-TR')}
                  </div>
                  {selectedHistoryBatch.completedAt && (
                    <div>
                      <strong>Tamamlanma:</strong> {new Date(selectedHistoryBatch.completedAt).toLocaleString('tr-TR')}
                    </div>
                  )}
                  {selectedHistoryBatch.rolledBackAt && (
                    <div>
                      <strong>Geri Alınma:</strong> {new Date(selectedHistoryBatch.rolledBackAt).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>
              </div>

              {selectedHistoryBatch.errorMessage && (
                <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', marginBottom: '1rem', color: '#dc2626' }}>
                  <strong>Hata Detayı:</strong> {selectedHistoryBatch.errorMessage}
                </div>
              )}

              {/* Stats Panel */}
              <div className="panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Aktarım Özeti</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Toplam</span>
                    <div><strong>{selectedHistoryBatch.totalRows}</strong></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Eklenen</span>
                    <div style={{ color: '#16a34a' }}><strong>{selectedHistoryBatch.importedRows}</strong></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Atlanan</span>
                    <div style={{ color: '#d97706' }}><strong>{selectedHistoryBatch.skippedRows}</strong></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hatalı</span>
                    <div style={{ color: '#dc2626' }}><strong>{selectedHistoryBatch.invalidRows}</strong></div>
                  </div>
                </div>
              </div>

              {/* Error Export Button if invalid rows exist */}
              {selectedHistoryBatch.invalidRows > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ width: '100%', marginBottom: '1rem' }}
                  onClick={() => void handleDownloadErrorsCsv(selectedHistoryBatch.id)}
                >
                  Hata Raporunu CSV Olarak İndir
                </button>
              )}
            </div>

            {/* Rollback Action */}
            {selectedHistoryBatch.status === 'COMPLETED' && (
              <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                <button
                  type="button"
                  className="action-button danger-btn"
                  style={{ width: '100%' }}
                  onClick={() => setShowRollbackModal(true)}
                >
                  Bu Aktarımı Geri Al
                </button>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  )
}
