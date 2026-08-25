import { useState, useEffect, useCallback } from 'react'
import {
  getManagementVehicles,
  getProperties,
  getBuildings,
} from '../api'
import type { PagedResidentVehicleResult, Property, Building, VehicleType } from '../types'

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR: 'Otomobil',
  MOTORCYCLE: 'Motosiklet',
  ELECTRIC_VEHICLE: 'Elektrikli Araç',
  SUV: 'SUV',
  OTHER: 'Diğer',
}

export function ManagementVehicles() {
  const [data, setData] = useState<PagedResidentVehicleResult>({
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

  // Filters
  const [plateNumber, setPlateNumber] = useState('')
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('')
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | ''>('')
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('')
  const [selectedIsActive, setSelectedIsActive] = useState<string>('')
  const [page, setPage] = useState(1)

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getManagementVehicles({
        plateNumber: plateNumber || undefined,
        propertyId: selectedPropertyId || undefined,
        buildingId: selectedBuildingId || undefined,
        vehicleType: selectedVehicleType || undefined,
        isActive: selectedIsActive === '' ? undefined : selectedIsActive === 'true',
        page,
        pageSize: 10,
      })
      setData(res)
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Araçlar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [plateNumber, selectedPropertyId, selectedBuildingId, selectedVehicleType, selectedIsActive, page])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

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

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const filteredBuildings = selectedPropertyId
    ? buildings.filter(b => b.propertyId === selectedPropertyId)
    : buildings

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
        <h1 className="text-2xl font-bold text-main">Araç Dizini</h1>
        <p className="text-sm text-muted mt-1">
          Site sakinlerine ait kayıtlı araç dizini ve plaka sorgulama.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="form-field">
            <label htmlFor="veh-search-plate">Plaka Arama</label>
            <input
              id="veh-search-plate"
              type="text"
              placeholder="34 ABC 123..."
              value={plateNumber}
              onChange={e => {
                setPlateNumber(e.target.value.toUpperCase())
                setPage(1)
              }}
            />
          </div>

          <div className="form-field">
            <label htmlFor="veh-search-prop">Site / Yapı</label>
            <select
              id="veh-search-prop"
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
            <label htmlFor="veh-search-bld">Blok</label>
            <select
              id="veh-search-bld"
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
            <label htmlFor="veh-search-type">Araç Tipi</label>
            <select
              id="veh-search-type"
              value={selectedVehicleType}
              onChange={e => {
                setSelectedVehicleType(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tümü</option>
              <option value="CAR">Otomobil</option>
              <option value="MOTORCYCLE">Motosiklet</option>
              <option value="ELECTRIC_VEHICLE">Elektrikli Araç</option>
              <option value="SUV">SUV</option>
              <option value="OTHER">Diğer</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="veh-search-active">Durum</label>
            <select
              id="veh-search-active"
              value={selectedIsActive}
              onChange={e => {
                setSelectedIsActive(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tümü</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="p-8 text-center text-muted">Araçlar yükleniyor...</div>
      ) : data.items.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-surface">
          <p className="text-muted">Kayıtlı araç bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="table-responsive rounded-xl border border-border bg-surface shadow-sm">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Plaka</th>
                  <th>Sakin</th>
                  <th>Daire</th>
                  <th>Yapı / Blok</th>
                  <th>Tür</th>
                  <th>Marka / Model</th>
                  <th>Renk</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(v => (
                  <tr key={v.id}>
                    <td>
                      <span className="font-mono font-bold text-main px-2 py-1 bg-surface-secondary rounded border border-border">
                        {v.plateNumber}
                      </span>
                    </td>
                    <td>{v.residentUserName}</td>
                    <td>No: {v.unitNumber}</td>
                    <td>{v.buildingName} ({v.propertyName})</td>
                    <td>{VEHICLE_TYPE_LABELS[v.vehicleType] || v.vehicleType}</td>
                    <td>{v.brandModel || '-'}</td>
                    <td>{v.color || '-'}</td>
                    <td>
                      <span className={`status-badge ${v.isActive ? 'status-badge-approved' : 'status-badge-neutral'}`}>
                        {v.isActive ? 'Aktif' : 'Pasif'}
                      </span>
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
    </div>
  )
}
