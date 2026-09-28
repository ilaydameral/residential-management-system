import { useCallback, useEffect, useState } from 'react'
import { downloadResidentDocument, getResidentDocument, getResidentDocuments } from '../api'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import type { DocumentCategory, ManagedDocument } from '../types'
import { LoadingSkeleton } from './LoadingSkeleton'

const CATEGORY_LABEL_MAP: Record<DocumentCategory, { label: string; className: string }> = {
  GENERAL: { label: 'Genel', className: 'status-badge secondary' },
  MANAGEMENT: { label: 'Yönetim', className: 'status-badge info' },
  FINANCE: { label: 'Finans', className: 'status-badge active' },
  MEETING: { label: 'Toplantı', className: 'status-badge secondary' },
  MAINTENANCE: { label: 'Bakım & Arıza', className: 'status-badge warning' },
  LEGAL: { label: 'Yasal & Hukuki', className: 'status-badge danger' },
  TECHNICAL: { label: 'Teknik', className: 'status-badge info' },
  OTHER: { label: 'Diğer', className: 'status-badge secondary' },
}

function DocumentFileIcon({ width = 20, height = 20 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function DownloadIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function formatTargetContext(doc: ManagedDocument): string {
  if (doc.targetType === 'UNIT' && doc.unitNumber) {
    const parts = [doc.propertyName]
    if (doc.buildingName) parts.push(doc.buildingName)
    parts.push(`Daire ${doc.unitNumber}`)
    return parts.join(' / ')
  }
  if (doc.targetType === 'BUILDING' && doc.buildingName) {
    return `${doc.propertyName} / ${doc.buildingName}`
  }
  return doc.propertyName || 'Site Geneli'
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    const day = d.getDate()
    const month = d.toLocaleString('tr-TR', { month: 'short' })
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  } catch {
    return dateString
  }
}

export function ResidentDocuments() {
  const { showToast } = useToast()

  const [documents, setDocuments] = useState<ManagedDocument[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Download loading per item
  const [downloadingIds, setDownloadingIds] = useState<Record<number, boolean>>({})

  // Detail drawer state
  const [selectedDocument, setSelectedDocument] = useState<ManagedDocument | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const { shouldRender: shouldRenderDetail, phase: detailPhase } = useAnimatedDrawer(isDrawerOpen)
  const detailDrawerRef = useDrawerAccessibility({
    isOpen: shouldRenderDetail && detailPhase !== 'closing',
    onClose: () => setIsDrawerOpen(false),
    enableSaveShortcut: false,
  })

  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getResidentDocuments({
        category: categoryFilter === 'all' ? undefined : (categoryFilter as DocumentCategory),
        search: searchQuery.trim() || undefined,
        page,
        pageSize,
      })
      setDocuments(res.items)
      setTotalCount(res.totalCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Belgeler yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter, searchQuery, page, pageSize])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const handleOpenDetail = async (docId: number) => {
    setIsDetailLoading(true)
    setIsDrawerOpen(true)
    try {
      const detail = await getResidentDocument(docId)
      setSelectedDocument(detail)
    } catch (err: any) {
      showToast(err.message || 'Belge detayları yüklenemedi.')
      setIsDrawerOpen(false)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleDownload = async (doc: ManagedDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (downloadingIds[doc.id]) return

    setDownloadingIds((prev) => ({ ...prev, [doc.id]: true }))
    try {
      const result = await downloadResidentDocument(doc.id)
      const url = window.URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.fileName || doc.originalFileName || `belge_${doc.id}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showToast('Belge başarıyla indirildi.')
    } catch (err: any) {
      showToast(err.message || 'Belge indirilirken bir hata oluştu.')
    } finally {
      setDownloadingIds((prev) => ({ ...prev, [doc.id]: false }))
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1
  const isFiltered = categoryFilter !== 'all' || searchQuery.trim().length > 0

  return (
    <section className="resident-view-content" aria-label="Sakin Belgeleri">
      <header className="resident-view-header">
        <p className="eyebrow">SAKİN PORTALI</p>
        <h1>Belgeler</h1>
        <p>Site, bina ve dairelerinize ait paylaşılan belgeleri inceleyin ve indirin.</p>
      </header>

      {/* Toolbar */}
      <section
        className="panel entity-toolbar"
        style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', padding: '14px 18px' }}
        aria-label="Belge filtreleri"
      >
        <div className="form-field" style={{ margin: 0, minWidth: '160px' }}>
          <label htmlFor="res-doc-category" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Kategori
          </label>
          <select
            id="res-doc-category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
            style={{ height: '38px', borderRadius: '8px', padding: '0 10px', fontSize: '0.86rem' }}
          >
            <option value="all">Tüm Kategoriler</option>
            <option value="GENERAL">Genel</option>
            <option value="MANAGEMENT">Yönetim</option>
            <option value="FINANCE">Finans</option>
            <option value="MEETING">Toplantı</option>
            <option value="MAINTENANCE">Bakım & Arıza</option>
            <option value="LEGAL">Yasal & Hukuki</option>
            <option value="TECHNICAL">Teknik</option>
            <option value="OTHER">Diğer</option>
          </select>
        </div>

        <div className="form-field" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
          <label htmlFor="res-doc-search" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Arama
          </label>
          <input
            id="res-doc-search"
            type="text"
            placeholder="Belge başlığı veya dosya adı ara..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            style={{ height: '38px', borderRadius: '8px', padding: '0 10px', fontSize: '0.86rem', width: '100%' }}
          />
        </div>

        {isFiltered && (
          <button
            type="button"
            className="secondary-button"
            style={{ height: '38px', alignSelf: 'flex-end', fontSize: '0.82rem' }}
            onClick={() => {
              setCategoryFilter('all')
              setSearchQuery('')
              setPage(1)
            }}
          >
            Filtreleri Temizle
          </button>
        )}
      </section>

      {/* List Content */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : error ? (
        <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
          <p className="status-message error-message">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void loadDocuments()}>
            Tekrar Dene
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="panel entity-state-panel actionable-empty-state">
          <h2>{isFiltered ? 'Arama kriterlerine uygun belge bulunamadı' : 'Kayıtlı belge bulunmuyor'}</h2>
          <p>
            {isFiltered
              ? 'Filtreleri temizleyerek veya farklı arama kelimeleri kullanarak tekrar deneyebilirsiniz.'
              : 'Siteniz veya bloğunuz için henüz paylaşılan bir belge bulunmamaktadır.'}
          </p>
          {isFiltered && (
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setCategoryFilter('all')
                setSearchQuery('')
                setPage(1)
              }}
            >
              Tüm Belgeleri Göster
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {documents.map((doc) => {
            const catMeta = CATEGORY_LABEL_MAP[doc.category] || { label: doc.category, className: 'status-badge secondary' }
            const targetText = formatTargetContext(doc)
            const isDownloading = downloadingIds[doc.id] ?? false

            return (
              <article
                key={doc.id}
                className="panel"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  borderRadius: '12px',
                  transition: 'box-shadow 0.15s ease',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1, minWidth: '260px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'var(--primary-light-bg, rgba(59, 130, 246, 0.1))',
                      color: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <DocumentFileIcon width={22} height={22} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className={catMeta.className}>{catMeta.label}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        {targetText}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                      {doc.title}
                    </h3>

                    {doc.description && (
                      <p style={{ margin: '0 0 6px 0', fontSize: '0.86rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                      <span>Dosya: {doc.originalFileName}</span>
                      <span>•</span>
                      <span>Boyut: {formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span>Yüklenme: {formatDate(doc.uploadedAt)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: '6px 12px', fontSize: '0.84rem' }}
                    onClick={() => void handleOpenDetail(doc.id)}
                  >
                    Detaylar
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={isDownloading}
                    style={{ padding: '6px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={(e) => void handleDownload(doc, e)}
                  >
                    <DownloadIcon width={14} height={14} />
                    {isDownloading ? 'İndiriliyor...' : 'İndir'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalCount > pageSize && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <div>Toplam {totalCount} belge</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="secondary-button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
            >
              ← Önceki
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
              Sayfa {page} / {totalPages}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {/* READ-ONLY DETAIL DRAWER */}
      {shouldRenderDetail && (
        <>
          <button
            className={`drawer-backdrop drawer-${detailPhase}`}
            type="button"
            aria-label="Kapat"
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside
            ref={detailDrawerRef}
            tabIndex={-1}
            className={`management-drawer drawer-${detailPhase}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="resident-doc-drawer-title"
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Belge Detayları</p>
                <h2 id="resident-doc-drawer-title">{selectedDocument?.title || 'Belge Bilgisi'}</h2>
              </div>
              <button
                type="button"
                className="drawer-close-button"
                aria-label="Kapat"
                onClick={() => setIsDrawerOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="drawer-body">
              {isDetailLoading ? (
                <LoadingSkeleton variant="detail" rows={5} />
              ) : selectedDocument ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="panel" style={{ padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Genel Bilgiler</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.9rem' }}>
                      <div>
                        <strong>Kategori:</strong>{' '}
                        <span className={CATEGORY_LABEL_MAP[selectedDocument.category]?.className || 'status-badge'}>
                          {CATEGORY_LABEL_MAP[selectedDocument.category]?.label || selectedDocument.category}
                        </span>
                      </div>
                      <div>
                        <strong>Hedef Kapsam:</strong> {formatTargetContext(selectedDocument)}
                      </div>
                      {selectedDocument.description && (
                        <div>
                          <strong>Açıklama:</strong>
                          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>
                            {selectedDocument.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="panel" style={{ padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Dosya Özellikleri</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.88rem' }}>
                      <div>
                        <strong>Dosya Adı:</strong>
                        <div style={{ wordBreak: 'break-all', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {selectedDocument.originalFileName}
                        </div>
                      </div>
                      <div>
                        <strong>Dosya Boyutu:</strong>
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {formatFileSize(selectedDocument.fileSize)}
                        </div>
                      </div>
                      <div>
                        <strong>Yükleyen:</strong>
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {selectedDocument.uploadedByName || `Kullanıcı #${selectedDocument.uploadedByUserId}`}
                        </div>
                      </div>
                      <div>
                        <strong>Yüklenme Tarihi:</strong>
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {formatDate(selectedDocument.uploadedAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ width: '100%', padding: '10px 16px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      disabled={downloadingIds[selectedDocument.id] ?? false}
                      onClick={() => void handleDownload(selectedDocument)}
                    >
                      <DownloadIcon width={16} height={16} />
                      {downloadingIds[selectedDocument.id] ? 'İndiriliyor...' : 'Belgeyi İndir'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </>
      )}
    </section>
  )
}
