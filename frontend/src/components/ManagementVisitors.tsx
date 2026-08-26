import { useState, useEffect, useCallback } from 'react'
import {
  getManagementVisitors,
  checkInVisitor,
  checkOutVisitor,
  getProperties,
  getBuildings,
} from '../api'
import type { Visitor, PagedVisitorResult, Property, Building, VisitorType } from '../types'
import { ConfirmationDialog } from './ConfirmationDialog'
import { useRealtime } from '../realtime/useRealtime'

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
  CANCELLED: 'İptal',
  EXPIRED: 'Süresi Doldu',
}

export function ManagementVisitors() {
  const [data, setData] = useState<PagedVisitorResult>({
    items: [],
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 1,
  })
  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Operational Action State
  const [checkingInVisitor, setCheckingInVisitor] = useState<Visitor | null>(null)
  const [checkingOutVisitor, setCheckingOutVisitor] = useState<Visitor | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('')
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | ''>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo] = useState('')
  const [page, setPage] = useState(1)

  const loadVisitors = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getManagementVisitors({
        search: search || undefined,
        propertyId: selectedPropertyId || undefined,
        buildingId: selectedBuildingId || undefined,
        status: selectedStatus || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: 10,
      })
      setData(res)
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Ziyaretçiler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [search, selectedPropertyId, selectedBuildingId, selectedStatus, dateFrom, dateTo, page])

  useEffect(() => {
    loadVisitors()
  }, [loadVisitors])

  useEffect(() => {
    async function loadMeta() {
      try {
        const [pList, bList] = await Promise.all([
          getProperties(),
          getBuildings(),
        ])
        setProperties(pList)
        setBuildings(bList)
      } catch (err) {
        console.error('Meta loading failed:', err)
      }
    }
    loadMeta()
  }, [])

  // Realtime SignalR listener
  const realtime = useRealtime()
  useEffect(() => {
    if (!realtime?.onVisitorStatusChanged) return
    const unsubscribe = realtime.onVisitorStatusChanged(() => {
      loadVisitors()
    })
    return () => unsubscribe()
  }, [realtime, loadVisitors])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const handleConfirmCheckIn = async () => {
    if (!checkingInVisitor) return
    try {
      setIsProcessing(true)
      await checkInVisitor(checkingInVisitor.id)
      setToastMessage(`${checkingInVisitor.visitorName} için giriş kaydı oluşturuldu.`)
      setCheckingInVisitor(null)
      await loadVisitors()
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Giriş işlemi başarısız.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmCheckOut = async () => {
    if (!checkingOutVisitor) return
    try {
      setIsProcessing(true)
      await checkOutVisitor(checkingOutVisitor.id)
      setToastMessage(`${checkingOutVisitor.visitorName} için çıkış kaydı oluşturuldu.`)
      setCheckingOutVisitor(null)
      await loadVisitors()
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Çıkış işlemi başarısız.')
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredBuildings = selectedPropertyId
    ? buildings.filter(b => b.propertyId === selectedPropertyId)
    : buildings

  // Operational Counts for Today
  const expectedCount = data.items.filter(v => v.status === 'EXPECTED').length
  const checkedInCount = data.items.filter(v => v.status === 'CHECKED_IN').length
  const checkedOutCount = data.items.filter(v => v.status === 'CHECKED_OUT').length

  return (
    <div className="management-visitors-container">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-lg bg-surface border border-border shadow-lg text-sm text-primary animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <p className="eyebrow">YÖNETİM PANELİ</p>
          <h1>Ziyaretçiler</h1>
          <p className="subtitle">
            Siteye gelen ziyaretçilerin giriş ve çıkış kayıtlarını yönetin.
          </p>
        </div>
      </div>

      {/* Operational Summary Cards */}
      <div className="management-visitor-metrics">
        <div className="management-visitor-metric-card">
          <div>
            <span className="metric-label">Beklenen</span>
            <div className="metric-value">{expectedCount}</div>
          </div>
          <div className="management-visitor-metric-icon expected">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        </div>

        <div className="management-visitor-metric-card">
          <div>
            <span className="metric-label">İçeride</span>
            <div className="metric-value" style={{ color: 'var(--color-success, #137333)' }}>{checkedInCount}</div>
          </div>
          <div className="management-visitor-metric-icon checked-in">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>

        <div className="management-visitor-metric-card">
          <div>
            <span className="metric-label">Çıkış Yapan</span>
            <div className="metric-value" style={{ color: 'var(--color-text-secondary)' }}>{checkedOutCount}</div>
          </div>
          <div className="management-visitor-metric-icon checked-out">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="management-visitor-filter-card">
        <div className="management-visitor-filter-row">
          <div className="form-field">
            <label htmlFor="mgmt-search">Arama</label>
            <input
              id="mgmt-search"
              type="text"
              placeholder="Ad, PIN veya plaka..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <div className="form-field">
            <label htmlFor="mgmt-prop">Site / Yapı</label>
            <select
              id="mgmt-prop"
              value={selectedPropertyId}
              onChange={e => {
                setSelectedPropertyId(e.target.value ? Number(e.target.value) : '')
                setSelectedBuildingId('')
                setPage(1)
              }}
            >
              <option value="">Tümü</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="mgmt-bld">Blok</label>
            <select
              id="mgmt-bld"
              value={selectedBuildingId}
              onChange={e => {
                setSelectedBuildingId(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
            >
              <option value="">Tümü</option>
              {filteredBuildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="mgmt-status">Durum</label>
            <select
              id="mgmt-status"
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tümü</option>
              <option value="EXPECTED">Bekleniyor</option>
              <option value="CHECKED_IN">Giriş Yaptı</option>
              <option value="CHECKED_OUT">Çıkış Yaptı</option>
              <option value="CANCELLED">İptal</option>
              <option value="EXPIRED">Süresi Doldu</option>
            </select>
          </div>
        </div>

        <div className="management-visitor-filter-row-secondary">
          <div className="form-field" style={{ minWidth: '220px' }}>
            <label htmlFor="mgmt-date-from">Başlangıç Tarihi</label>
            <input
              id="mgmt-date-from"
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {(Boolean(search) || Boolean(selectedPropertyId) || Boolean(selectedBuildingId) || Boolean(selectedStatus) || Boolean(dateFrom)) && (
            <button
              type="button"
              className="ghost-button"
              style={{ fontSize: '13px' }}
              onClick={() => {
                setSearch('')
                setSelectedPropertyId('')
                setSelectedBuildingId('')
                setSelectedStatus('')
                setDateFrom('')
                setPage(1)
              }}
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)' }}>
          Ziyaretçiler yükleniyor...
        </div>
      ) : data.items.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px' }}>
          <p className="text-muted">Kayıtlı ziyaretçi bulunamadı.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="table-responsive management-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="management-table management-visitor-table">
              <thead>
                <tr>
                  <th className="col-visitor">Ziyaretçi</th>
                  <th className="col-host">Ev Sahibi</th>
                  <th className="col-unit">Daire</th>
                  <th className="col-property">Yapı / Blok</th>
                  <th className="col-range">Ziyaret Aralığı</th>
                  <th className="col-vehicle">Araç</th>
                  <th className="col-status">Durum</th>
                  <th className="col-code">Giriş Kodu</th>
                  <th className="col-actions" style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(v => (
                  <tr key={v.id}>
                    <td className="col-visitor">
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{v.visitorName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {VISITOR_TYPE_LABELS[v.visitorType] || v.visitorType}
                        {v.visitorPhone ? ` • ${v.visitorPhone}` : ''}
                      </div>
                    </td>
                    <td className="col-host">{v.hostUserName || '-'}</td>
                    <td className="col-unit">Daire {v.unitNumber}</td>
                    <td className="col-property">
                      <div style={{ fontWeight: 500 }}>{v.propertyName || v.buildingName}</div>
                      {v.propertyName && v.buildingName && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{v.buildingName}</div>
                      )}
                    </td>
                    <td className="col-range">
                      <div style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {new Date(v.expectedArrival).toLocaleString('tr-TR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                        <span style={{ color: 'var(--color-text-tertiary)', margin: '0 4px' }}>→</span>
                        {new Date(v.expectedDeparture).toLocaleString('tr-TR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </div>
                    </td>
                    <td className="col-vehicle">
                      {v.vehiclePlate ? (
                        <span className="resident-visitor-plate-code">
                          {v.vehiclePlate}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>
                      )}
                    </td>
                    <td className="col-status">
                      <span className={`status-badge ${STATUS_BADGE_CLASSES[v.status] || 'inactive'}`}>
                        {STATUS_LABELS[v.status] || v.status}
                      </span>
                    </td>
                    <td className="col-code">
                      <code className="resident-visitor-access-value" style={{ fontSize: '14px' }}>
                        {v.accessCode}
                      </code>
                    </td>
                    <td className="col-actions" style={{ textAlign: 'right' }}>
                      {v.status === 'EXPECTED' && (
                        <button
                          type="button"
                          className="row-primary-action primary"
                          onClick={() => setCheckingInVisitor(v)}
                        >
                          Giriş Yap
                        </button>
                      )}
                      {v.status === 'CHECKED_IN' && (
                        <button
                          type="button"
                          className="row-primary-action"
                          onClick={() => setCheckingOutVisitor(v)}
                        >
                          Çıkış Yap
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Toplam {data.totalCount} kayıt • Sayfa {data.page} / {data.totalPages}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  disabled={data.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Önceki
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Check In Dialog */}
      {checkingInVisitor && (
        <ConfirmationDialog
          title="Ziyaretçi Girişi"
          message={`${checkingInVisitor.visitorName} isimli ziyaretçinin binalara/siteye girişini onaylıyor musunuz?`}
          confirmLabel="Giriş Yap"
          isLoading={isProcessing}
          onConfirm={handleConfirmCheckIn}
          onCancel={() => setCheckingInVisitor(null)}
        />
      )}

      {/* Check Out Dialog */}
      {checkingOutVisitor && (
        <ConfirmationDialog
          title="Ziyaretçi Çıkışı"
          message={`${checkingOutVisitor.visitorName} isimli ziyaretçinin çıkışını onaylıyor musunuz?`}
          confirmLabel="Çıkış Yap"
          isLoading={isProcessing}
          onConfirm={handleConfirmCheckOut}
          onCancel={() => setCheckingOutVisitor(null)}
        />
      )}
    </div>
  )
}
