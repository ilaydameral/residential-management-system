import { useState, useEffect, useCallback } from 'react'
import {
  getManagementVehicles,
  getProperties,
  getBuildings,
} from '../api'
import type { PagedResidentVehicleResult, Property, Building, VehicleType } from '../types'
import { LoadingSkeleton } from './LoadingSkeleton'

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
  const [loadError, setLoadError] = useState<string | null>(null)

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
      setLoadError(null)
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
      setLoadError(err instanceof Error ? err.message : 'Araçlar yüklenemedi.')
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

  const filteredBuildings = selectedPropertyId
    ? buildings.filter(b => b.propertyId === selectedPropertyId)
    : buildings

  const handleClearFilters = () => {
    setPlateNumber('')
    setSelectedPropertyId('')
    setSelectedBuildingId('')
    setSelectedVehicleType('')
    setSelectedIsActive('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(
    plateNumber || selectedPropertyId || selectedBuildingId || selectedVehicleType || selectedIsActive !== ''
  )

  return (
    <div className="management-vehicles-container">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <p className="eyebrow">YÖNETİM PANELİ</p>
          <h1>Araç Dizini</h1>
          <p className="subtitle">
            Site sakinlerine ait kayıtlı araç dizini ve plaka sorgulama.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="management-vehicle-filter-card">
        <div className="management-vehicle-filter-row">
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

        {hasActiveFilters && (
          <div className="management-vehicle-filter-row-secondary">
            <button
              type="button"
              className="ghost-button"
              onClick={handleClearFilters}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Filtreleri Temizle
            </button>
          </div>
        )}
      </div>

      {/* Table Section */}
      {loading ? (
        <LoadingSkeleton variant="table" rows={5} />
      ) : loadError ? (
        <section className="panel entity-state-panel error-state" role="alert">
          <p className="status-message error-message">{loadError}</p>
          <button type="button" className="secondary-button" onClick={() => void loadVehicles()}>Tekrar Dene</button>
        </section>
      ) : data.items.length === 0 ? (
        <section className="panel entity-state-panel actionable-empty-state">
          <h2>{hasActiveFilters ? 'Filtrelere uygun araç bulunamadı' : 'Kayıtlı araç bulunamadı'}</h2>
          <p>{hasActiveFilters ? 'Arama ölçütlerini değiştirin veya filtreleri temizleyin.' : 'Sakinlerin kaydettiği araçlar burada görüntülenecek.'}</p>
          {hasActiveFilters && <button type="button" className="secondary-button" onClick={handleClearFilters}>Filtreleri Temizle</button>}
        </section>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="table-responsive management-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="management-table management-vehicle-table">
              <thead>
                <tr>
                  <th className="col-plate">Plaka</th>
                  <th className="col-resident">Sakin</th>
                  <th className="col-unit">Daire</th>
                  <th className="col-property">Yapı / Blok</th>
                  <th className="col-type">Tür</th>
                  <th className="col-brand">Marka / Model</th>
                  <th className="col-color">Renk</th>
                  <th className="col-status">Durum</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(v => (
                  <tr key={v.id}>
                    <td className="col-plate">
                      <span className="resident-visitor-plate-code">
                        {v.plateNumber}
                      </span>
                    </td>
                    <td className="col-resident">{v.residentUserName}</td>
                    <td className="col-unit">Daire {v.unitNumber}</td>
                    <td className="col-property">
                      <div style={{ fontWeight: 500 }}>{v.propertyName || v.buildingName}</div>
                      {v.propertyName && v.buildingName && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{v.buildingName}</div>
                      )}
                    </td>
                    <td className="col-type">{VEHICLE_TYPE_LABELS[v.vehicleType] || v.vehicleType}</td>
                    <td className="col-brand">{v.brandModel || '-'}</td>
                    <td className="col-color">{v.color || '-'}</td>
                    <td className="col-status">
                      <span className={`status-badge ${v.isActive ? 'active' : 'inactive'}`}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Toplam {data.totalCount} kayıt • Sayfa {data.page} / {data.totalPages}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: '4px 12px', fontSize: '13px' }}
                  disabled={data.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Önceki
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: '4px 12px', fontSize: '13px' }}
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
