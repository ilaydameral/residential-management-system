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
    <div className="space-y-6">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-lg bg-surface border border-border shadow-lg text-sm text-primary animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-main">Ziyaretçi Yönetimi</h1>
        <p className="text-sm text-muted mt-1">
          Siteye gelen ziyaretçilerin giriş ve çıkış kayıtlarını yönetin.
        </p>
      </div>

      {/* Operational Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Beklenen</span>
            <div className="text-2xl font-bold text-main mt-1">{expectedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-warning-soft text-warning flex items-center justify-center font-bold">
            ⏳
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">İçeride</span>
            <div className="text-2xl font-bold text-success mt-1">{checkedInCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-success-soft text-success flex items-center justify-center font-bold">
            ✓
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Çıkış Yapan</span>
            <div className="text-2xl font-bold text-secondary mt-1">{checkedOutCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-secondary text-secondary flex items-center justify-center font-bold">
            ➜
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

          <div className="form-field">
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
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="p-8 text-center text-muted">Ziyaretçiler yükleniyor...</div>
      ) : data.items.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-surface">
          <p className="text-muted">Kayıtlı ziyaretçi bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="table-responsive rounded-xl border border-border bg-surface shadow-sm">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Ziyaretçi</th>
                  <th>Ev Sahibi</th>
                  <th>Daire</th>
                  <th>Yapı / Blok</th>
                  <th>Ziyaret Aralığı</th>
                  <th>Araç</th>
                  <th>Durum</th>
                  <th>Giriş Kodu</th>
                  <th className="text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(v => (
                  <tr key={v.id}>
                    <td>
                      <div className="font-semibold text-main">{v.visitorName}</div>
                      <div className="text-xs text-muted">
                        {VISITOR_TYPE_LABELS[v.visitorType] || v.visitorType}
                        {v.visitorPhone ? ` • ${v.visitorPhone}` : ''}
                      </div>
                    </td>
                    <td>{v.hostUserName}</td>
                    <td>No: {v.unitNumber}</td>
                    <td>{v.buildingName}</td>
                    <td>
                      <div className="text-xs">
                        <div>
                          {new Date(v.expectedArrival).toLocaleString('tr-TR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                        <div className="text-muted">
                          -{' '}
                          {new Date(v.expectedDeparture).toLocaleString('tr-TR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      </div>
                    </td>
                    <td>
                      {v.vehiclePlate ? (
                        <span className="font-mono font-bold text-xs px-2 py-0.5 bg-surface-secondary rounded border border-border">
                          {v.vehiclePlate}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${STATUS_BADGE_CLASSES[v.status] || 'status-badge-neutral'}`}>
                        {STATUS_LABELS[v.status] || v.status}
                      </span>
                    </td>
                    <td>
                      <code className="font-mono font-bold text-xs px-2 py-0.5 bg-surface-secondary rounded border border-border text-primary">
                        {v.accessCode}
                      </code>
                    </td>
                    <td className="text-right space-x-2">
                      {v.status === 'EXPECTED' && (
                        <button
                          type="button"
                          className="primary-button text-xs py-1 px-2"
                          onClick={() => setCheckingInVisitor(v)}
                        >
                          Giriş Yap
                        </button>
                      )}
                      {v.status === 'CHECKED_IN' && (
                        <button
                          type="button"
                          className="secondary-button text-xs py-1 px-2"
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
            <div className="flex items-center justify-between px-2">
              <span className="text-xs text-muted">
                Toplam {data.totalCount} kayıt • Sayfa {data.page} / {data.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="secondary-button text-xs py-1 px-3"
                  disabled={data.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Önceki
                </button>
                <button
                  type="button"
                  className="secondary-button text-xs py-1 px-3"
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
