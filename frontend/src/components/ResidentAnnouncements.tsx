import { useCallback, useEffect, useRef, useState } from 'react'
import { getResidentAnnouncement, getResidentAnnouncements } from '../api'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import type { AnnouncementDto } from '../types'
import { LoadingSkeleton } from './LoadingSkeleton'

const PRIORITY_LABEL_MAP: Record<string, { label: string; className: string }> = {
  NORMAL: { label: 'Normal', className: 'status-badge secondary' },
  IMPORTANT: { label: 'Önemli', className: 'status-badge warning' },
  URGENT: { label: 'Acil', className: 'status-badge danger' },
}

function MegaphoneIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  )
}

function formatAnnouncementDate(dateString?: string | null): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    const day = d.getDate()
    const month = d.toLocaleString('tr-TR', { month: 'short' })
    const year = d.getFullYear()
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${day} ${month} ${year} • ${hours}:${minutes}`
  } catch {
    return dateString
  }
}

export function ResidentAnnouncements() {
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [priorityFilter, setPriorityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Detail drawer state
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementDto | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const detailBodyRef = useRef<HTMLDivElement>(null)

  const { shouldRender: shouldRenderDetail, phase: detailPhase } = useAnimatedDrawer(isDrawerOpen)
  const detailDrawerRef = useDrawerAccessibility({
    isOpen: shouldRenderDetail && detailPhase !== 'closing',
    onClose: () => setIsDrawerOpen(false),
    enableSaveShortcut: false,
  })

  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getResidentAnnouncements({
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        search: searchQuery.trim() || undefined,
        page,
        pageSize,
      })
      setAnnouncements(res.items)
      setTotalCount(res.totalCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyurular yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [priorityFilter, searchQuery, page, pageSize])

  useEffect(() => {
    void loadAnnouncements()
  }, [loadAnnouncements])

  const handleOpenDetail = async (id: number) => {
    setIsDetailLoading(true)
    setIsDrawerOpen(true)
    try {
      const detail = await getResidentAnnouncement(id)
      setSelectedAnnouncement(detail)
    } catch (err: any) {
      setError(err.message || 'Duyuru detayı yüklenemedi.')
      setIsDrawerOpen(false)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <section className="resident-view-content" aria-label="Resident Announcements">
      <header className="resident-view-header">
        <p className="eyebrow">SAKİN PORTALI</p>
        <h1>Duyurular</h1>
        <p>Site ve bloğunuzla ilgili güncel duyuruları takip edin.</p>
      </header>

      {/* Toolbar */}
      <section className="panel entity-toolbar" style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', padding: '14px 18px' }} aria-label="Duyuru filtreleri">
        <div className="form-field" style={{ margin: 0, minWidth: '150px' }}>
          <label htmlFor="res-ann-priority" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>Öncelik</label>
          <select
            id="res-ann-priority"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value)
              setPage(1)
            }}
            style={{ height: '38px', borderRadius: '8px', padding: '0 10px', fontSize: '0.86rem' }}
          >
            <option value="all">Tüm Öncelikler</option>
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Önemli</option>
            <option value="URGENT">Acil</option>
          </select>
        </div>

        <div className="form-field" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
          <label htmlFor="res-ann-search" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>Arama</label>
          <input
            id="res-ann-search"
            type="text"
            placeholder="Duyuru başlığı ara..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            style={{ height: '38px', borderRadius: '8px', padding: '0 10px', fontSize: '0.86rem', width: '100%' }}
          />
        </div>
      </section>

      {/* List Content */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : error ? (
        <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
          <p className="status-message error-message">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void loadAnnouncements()}>
            Tekrar Dene
          </button>
        </div>
      ) : announcements.length === 0 ? (
        <div className="panel entity-state-panel actionable-empty-state">
          <h2>Güncel duyuru bulunmuyor</h2>
          <p>Siteniz veya bloğunuz için yayınlanmış yeni duyuru olduğunda burada görüntülenecektir.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {announcements.map((ann) => {
            const prioMeta = PRIORITY_LABEL_MAP[ann.priority] || { label: ann.priority, className: 'status-badge secondary' }
            const scopeText = ann.buildingName ? `${ann.propertyName} (${ann.buildingName})` : `${ann.propertyName} (Site Geneli)`

            return (
              <article
                key={ann.id}
                className="panel"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  borderRadius: '12px',
                  transition: 'box-shadow 0.15s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span className={prioMeta.className}>{prioMeta.label}</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      {scopeText}
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                    {ann.title}
                  </h3>
                  {ann.content && (
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ann.content.length > 120 ? `${ann.content.slice(0, 120)}...` : ann.content}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {formatAnnouncementDate(ann.publishedAt || ann.createdAt)}
                  </span>
                  <button
                    className="table-detail-button"
                    type="button"
                    onClick={() => handleOpenDetail(ann.id)}
                  >
                    Detay
                  </button>
                </div>
              </article>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
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

      {/* Resident Detail Drawer */}
      {shouldRenderDetail && selectedAnnouncement && (
        <>
          <button
            className={`drawer-backdrop drawer-${detailPhase}`}
            type="button"
            aria-label="Duyuru detayını kapat"
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside
            ref={detailDrawerRef}
            tabIndex={-1}
            className={`management-drawer announcement-drawer drawer-container drawer-${detailPhase}`}
            role="dialog"
            aria-modal="true"
            aria-label="Duyuru Detayı"
            style={{ width: 'min(540px, 94vw)' }}
          >
            <div className="drawer-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ display: 'grid', placeItems: 'center', width: '26px', height: '26px', borderRadius: '6px', background: 'var(--color-surface-secondary)', color: 'var(--color-primary)' }}>
                    <MegaphoneIcon width={14} height={14} />
                  </div>
                  <span className={(PRIORITY_LABEL_MAP[selectedAnnouncement.priority] || {}).className}>
                    {(PRIORITY_LABEL_MAP[selectedAnnouncement.priority] || {}).label || selectedAnnouncement.priority}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>{selectedAnnouncement.title}</h3>
              </div>
              <button className="drawer-close-button" type="button" aria-label="Kapat" onClick={() => setIsDrawerOpen(false)}>
                ✕
              </button>
            </div>

            <div className="drawer-body" ref={detailBodyRef} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {isDetailLoading ? (
                <LoadingSkeleton variant="detail" />
              ) : (
                <>
                  {/* Metadata Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '10px 14px',
                      padding: '12px 14px',
                      background: 'var(--color-surface-secondary)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Kapsam</span>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)' }}>
                        {selectedAnnouncement.buildingName
                          ? `${selectedAnnouncement.propertyName} (${selectedAnnouncement.buildingName})`
                          : `${selectedAnnouncement.propertyName} (Site Geneli)`}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Yayınlanma Tarihi</span>
                      <span style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {formatAnnouncementDate(selectedAnnouncement.publishedAt || selectedAnnouncement.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Announcement Content Box */}
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Duyuru İçeriği
                    </span>
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: '8px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.92rem',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedAnnouncement.content}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="drawer-footer">
              <button className="secondary-button" type="button" onClick={() => setIsDrawerOpen(false)}>
                Kapat
              </button>
            </div>
          </aside>
        </>
      )}
    </section>
  )
}
