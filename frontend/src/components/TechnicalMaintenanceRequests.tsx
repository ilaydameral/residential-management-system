import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTechnicalMaintenanceRequests } from '../api'
import { useRealtimeMaintenance } from '../realtime/useRealtimeMaintenance'
import type { MaintenanceRequestListItemDto } from '../types'
import { LoadingSkeleton } from './LoadingSkeleton'
import { RowActionsMenu } from './RowActionsMenu'
import { PageHeader } from './PageHeader'

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

const PRIORITY_LABEL_MAP: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Düşük', className: 'status-badge muted' },
  NORMAL: { label: 'Normal', className: 'status-badge secondary' },
  IMPORTANT: { label: 'Önemli', className: 'status-badge warning' },
  HIGH: { label: 'Önemli', className: 'status-badge warning' },
  URGENT: { label: 'Acil', className: 'status-badge danger' },
  EMERGENCY: { label: 'Acil', className: 'status-badge danger' },
}

const STATUS_LABEL_MAP: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Açık', className: 'status-badge warning' },
  IN_PROGRESS: { label: 'İşlemde', className: 'status-badge info' },
  RESOLVED: { label: 'Çözüldü', className: 'status-badge active' },
  CLOSED: { label: 'Kapandı', className: 'status-badge inactive' },
  CANCELLED: { label: 'İptal Edildi', className: 'status-badge secondary' },
}

function formatUnitLocation(propertyName?: string | null, buildingName?: string | null, unitNumber?: string | null): string {
  if (!propertyName) return '—'
  let bName = (buildingName || '').trim()
  if (bName && bName.toLowerCase() === propertyName.trim().toLowerCase()) {
    bName = ''
  }
  const uNum = (unitNumber || '').trim()
  const cleanUnit = uNum ? (uNum.startsWith('D:') ? uNum : `D:${uNum}`) : ''

  if (!bName) {
    return cleanUnit ? `${propertyName.trim()} / ${cleanUnit}` : propertyName.trim()
  }
  return cleanUnit ? `${propertyName.trim()} / ${bName} / ${cleanUnit}` : `${propertyName.trim()} / ${bName}`
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

export function TechnicalMaintenanceRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<MaintenanceRequestListItemDto[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getTechnicalMaintenanceRequests({
        status: statusFilter === 'all' ? undefined : statusFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        search: searchQuery ? searchQuery.trim() : undefined,
        page,
        pageSize,
      })
      setRequests(res.items)
      setTotalCount(res.totalCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Atanan talepler yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery, page, pageSize])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  useRealtimeMaintenance(
    useCallback(() => {
      void loadRequests()
    }, [loadRequests]),
    () => {
      void loadRequests()
    }
  )

  const handleOpenDetail = (id: number) => {
    navigate(`/technical/requests/${id}`)
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="management-page">
      <PageHeader
        eyebrow="Teknik Personel Portalı"
        title="Atanan Talepler"
        subtitle="Üzerinize atanan bakım ve onarım taleplerini takip edin ve işlem durumlarını güncelleyin."
      />

      {/* Standard Management Entity Toolbar */}
      <section className="panel entity-toolbar request-toolbar" aria-label="Talep filtreleri">
        <div className="form-field">
          <label htmlFor="tech-req-status">Durum</label>
          <select
            id="tech-req-status"
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
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="tech-req-priority">Öncelik</label>
          <select
            id="tech-req-priority"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tüm Öncelikler</option>
            <option value="LOW">Düşük</option>
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Önemli</option>
            <option value="URGENT">Acil</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="tech-req-category">Kategori</label>
          <select
            id="tech-req-category"
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

        <div className="search-field form-field">
          <label htmlFor="tech-req-search">Arama</label>
          <input
            id="tech-req-search"
            type="text"
            placeholder="Talep No / Başlık / Sakin ara..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
          />
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
        <section className="panel entity-state-panel actionable-empty-state">
          <h2>Üzerinize atanan talep bulunmuyor</h2>
          <p>Şu anda atanan aktif bir teknik talep bulunmamaktadır.</p>
        </section>
      ) : (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th style={{ width: '150px', whiteSpace: 'nowrap' }}>Talep No</th>
                  <th style={{ minWidth: '180px' }}>Başlık</th>
                  <th style={{ minWidth: '180px' }}>Site / Blok / Daire</th>
                  <th style={{ minWidth: '140px' }}>Talep Eden</th>
                  <th style={{ minWidth: '130px' }}>Kategori</th>
                  <th style={{ width: '100px' }}>Öncelik</th>
                  <th style={{ width: '100px' }}>Durum</th>
                  <th style={{ width: '140px', whiteSpace: 'nowrap' }}>Tarih</th>
                  <th className="text-right" style={{ width: '90px' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const statusMeta = STATUS_LABEL_MAP[req.status] || { label: req.status, className: 'status-badge secondary' }
                  const prioMeta = PRIORITY_LABEL_MAP[req.priority] || { label: req.priority, className: 'status-badge secondary' }
                  const categoryLabel = CATEGORY_LABEL_MAP[req.category] || req.category
                  const locationStr = formatUnitLocation(req.propertyName, req.buildingName, req.unitNumber)

                  return (
                    <tr key={req.id} className="clickable-row" onClick={() => handleOpenDetail(req.id)}>
                      <td>
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
                            display: 'inline-block',
                          }}
                        >
                          {req.requestNumber}
                        </code>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.92rem' }}>{req.title}</strong>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem' }}>
                        {locationStr}
                      </td>
                      <td style={{ color: 'var(--color-text-primary)', fontSize: '0.88rem', fontWeight: 500 }}>
                        {req.createdByName}
                      </td>
                      <td style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
                        {categoryLabel}
                      </td>
                      <td>
                        <span className={prioMeta.className}>{prioMeta.label}</span>
                      </td>
                      <td>
                        <span className={statusMeta.className}>{statusMeta.label}</span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {formatDate(req.createdAt)}
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu label={req.title} primaryAction={{ label: 'Detay', onSelect: () => handleOpenDetail(req.id) }} />
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
        </section>
      )}
    </div>
  )
}
