import React, { useState, useEffect, useId } from 'react'
import type { Property, Building } from '../types'
import {
  getProperties,
  getBuildingsByProperty,
  getBuildingFloorMap,
} from '../api'
import type {
  BuildingFloorMapDto,
  FloorMapUnitDto,
} from '../api'

interface BuildingFloorMapManagementProps {
  onNavigateToUnit?: (unitId: number) => void
  onNavigateToMaintenance?: (unitId: number) => void
}

export const BuildingFloorMapManagement: React.FC<BuildingFloorMapManagementProps> = ({
  onNavigateToUnit,
  onNavigateToMaintenance,
}) => {
  const propertySelectId = useId()
  const buildingSelectId = useId()

  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)

  const [floorMap, setFloorMap] = useState<BuildingFloorMapDto | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [buildingsLoading, setBuildingsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Drawer state for selected unit
  const [selectedUnit, setSelectedUnit] = useState<FloorMapUnitDto | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  // Load properties on mount
  useEffect(() => {
    let isMounted = true
    const loadProps = async () => {
      try {
        const propsData = await getProperties()
        if (isMounted) {
          const activeProps = (propsData || []).filter((p: Property) => p.isActive)
          setProperties(activeProps)
          if (activeProps.length > 0) {
            setSelectedPropertyId(activeProps[0].id)
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Gayrimenkul listesi yüklenemedi.')
        }
      }
    }
    loadProps()
    return () => {
      isMounted = false
    }
  }, [])

  // Load buildings when selectedPropertyId changes
  useEffect(() => {
    let isMounted = true
    if (!selectedPropertyId) {
      setBuildings([])
      setSelectedBuildingId(null)
      setFloorMap(null)
      return
    }

    const loadBldgs = async () => {
      setBuildingsLoading(true)
      try {
        const bldgsData = await getBuildingsByProperty(selectedPropertyId)
        if (isMounted) {
          const activeBldgs = (bldgsData || []).filter((b: Building) => b.isActive)
          setBuildings(activeBldgs)
          if (activeBldgs.length > 0) {
            setSelectedBuildingId(activeBldgs[0].id)
          } else {
            setSelectedBuildingId(null)
            setFloorMap(null)
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Bina listesi yüklenemedi.')
        }
      } finally {
        if (isMounted) setBuildingsLoading(false)
      }
    }
    loadBldgs()
    return () => {
      isMounted = false
    }
  }, [selectedPropertyId])

  // Load floor map when selectedBuildingId changes
  useEffect(() => {
    let isMounted = true
    if (!selectedBuildingId) {
      setFloorMap(null)
      return
    }

    const loadMap = async () => {
      setLoading(true)
      setError(null)
      try {
        const mapData = await getBuildingFloorMap(selectedBuildingId)
        if (isMounted) {
          setFloorMap(mapData)
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Kat planı yüklenirken bir hata oluştu.')
          setFloorMap(null)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadMap()
    return () => {
      isMounted = false
    }
  }, [selectedBuildingId])

  const handleUnitClick = (unit: FloorMapUnitDto) => {
    setSelectedUnit(unit)
    setIsDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false)
    setSelectedUnit(null)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val)
  }

  const allUnits = floorMap?.floors.flatMap((f) => f.units) || []
  const occupiedCount = allUnits.filter((u) => u.occupancyStatus !== 'VACANT').length
  const vacantCount = allUnits.filter((u) => u.occupancyStatus === 'VACANT').length
  const overdueCount = allUnits.filter((u) => u.hasOverdueDebt).length
  const activeMaintenanceCount = allUnits.filter((u) => u.openMaintenanceRequestCount > 0).length

  return (
    <div className="management-page floor-map-management-page">
      {/* Property & Building Selector Panel (Parent App.tsx owns page header) */}
      <section className="floor-map-controls-panel">
        <div className="selector-group">
          <div className="field-group">
            <label htmlFor={propertySelectId}>Site / Gayrimenkul</label>
            <select
              id={propertySelectId}
              className="select-input"
              value={selectedPropertyId || ''}
              onChange={(e) => setSelectedPropertyId(Number(e.target.value) || null)}
            >
              {properties.length === 0 && <option value="">Site yükleniyor...</option>}
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor={buildingSelectId}>Bina / Blok</label>
            <select
              id={buildingSelectId}
              className="select-input"
              value={selectedBuildingId || ''}
              onChange={(e) => setSelectedBuildingId(Number(e.target.value) || null)}
              disabled={buildingsLoading || buildings.length === 0}
            >
              {buildingsLoading ? (
                <option value="">Binalar yükleniyor...</option>
              ) : buildings.length === 0 ? (
                <option value="">Bu sitede bina bulunamadı</option>
              ) : (
                buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </section>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Guidance state when no building is selected */}
      {!selectedBuildingId && !loading && !error && (
        <div className="floor-map-guidance-card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
          </svg>
          <h3>Kat planını görüntülemek için site ve bina seçin.</h3>
          <p>Yukarıdaki menüden incelemek istediğiniz gayrimenkul ve bina kaydını seçerek kat durumlarını yükleyebilirsiniz.</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="floor-map-loading-container">
          <div className="spinner" />
          <p>Kat planı yükleniyor...</p>
        </div>
      )}

      {/* Loaded Floor Map Content */}
      {floorMap && !loading && (
        <>
          {/* Summary Strip */}
          <div className="floor-map-summary-strip">
            <div className="summary-building-info">
              <div className="building-icon-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                  <path d="M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
                </svg>
              </div>
              <div>
                <h2>{floorMap.buildingName}</h2>
                <p className="building-meta">{floorMap.propertyName} • {floorMap.buildingCode}</p>
              </div>
            </div>

            <div className="summary-metrics-group">
              <span className="summary-pill pill-total">
                <strong>{floorMap.totalFloors}</strong> Kat • <strong>{floorMap.totalUnits}</strong> Daire
              </span>
              <span className="summary-pill pill-occupied">
                <span className="dot dot-occupied" /> Dolu: <strong>{occupiedCount}</strong>
              </span>
              <span className="summary-pill pill-vacant">
                <span className="dot dot-vacant" /> Boş: <strong>{vacantCount}</strong>
              </span>
              {overdueCount > 0 && (
                <span className="summary-pill pill-overdue">
                  <span className="dot dot-overdue" /> Gecikmiş Borçlu: <strong>{overdueCount}</strong>
                </span>
              )}
              {activeMaintenanceCount > 0 && (
                <span className="summary-pill pill-maintenance">
                  <span className="dot dot-maintenance" /> Aktif Bakımlı: <strong>{activeMaintenanceCount}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Zero units warning */}
          {floorMap.floors.length === 0 && (
            <div className="floor-map-guidance-card">
              <p>Bu binada görüntülenecek daire bulunmuyor.</p>
            </div>
          )}

          {/* Floors Vertical List */}
          <div className="floors-container">
            {floorMap.floors.map((floor) => (
              <div key={floor.floorNumber} className="floor-row">
                <div className="floor-label-column">
                  <span className="floor-label-badge">{floor.floorLabel}</span>
                  <small className="floor-unit-count">{floor.unitCount} Daire</small>
                </div>

                <div className="floor-units-grid">
                  {floor.units.map((unit) => {
                    const isOccupiedOwner = unit.occupancyStatus === 'OCCUPIED_OWNER'
                    const isVacant = unit.occupancyStatus === 'VACANT'

                    let maintBadgeClass = ''
                    let maintLabel = ''
                    if (unit.maintenanceStatus === 'EMERGENCY') {
                      maintBadgeClass = 'maint-emergency'
                      maintLabel = 'Acil'
                    } else if (unit.maintenanceStatus === 'HIGH') {
                      maintBadgeClass = 'maint-high'
                      maintLabel = 'Yüksek'
                    } else if (unit.maintenanceStatus === 'NORMAL') {
                      maintBadgeClass = 'maint-normal'
                      maintLabel = 'Normal'
                    } else if (unit.maintenanceStatus === 'LOW') {
                      maintBadgeClass = 'maint-low'
                      maintLabel = 'Düşük'
                    }

                    const tooltipText = `Daire ${unit.unitNumber} (${unit.unitTypeName})\n` +
                      `Durum: ${isVacant ? 'Boş' : isOccupiedOwner ? 'Malik' : 'Kiracı'} ${unit.primaryResidentName ? `- ${unit.primaryResidentName}` : ''}\n` +
                      `Bakiye: ${unit.outstandingBalance > 0 ? formatCurrency(unit.outstandingBalance) : 'Borç Yok'}` +
                      `${unit.hasOverdueDebt ? ' (GECİKMİŞ BORÇ)' : ''}\n` +
                      `Bakım Talebi: ${unit.openMaintenanceRequestCount > 0 ? `${unit.openMaintenanceRequestCount} adet (${unit.maintenanceStatus})` : 'Yok'}`

                    return (
                      <button
                        key={unit.unitId}
                        type="button"
                        className={`unit-card ${isVacant ? 'card-vacant' : 'card-occupied'} ${unit.hasEmergencyMaintenanceRequest ? 'has-emergency' : ''}`}
                        onClick={() => handleUnitClick(unit)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleUnitClick(unit)
                          }
                        }}
                        aria-expanded={isDrawerOpen && selectedUnit?.unitId === unit.unitId}
                        title={tooltipText}
                      >
                        <div className="unit-card-header">
                          <span className="unit-number-title">No: {unit.unitNumber}</span>
                          <span className="unit-type-pill">{unit.unitTypeName}</span>
                        </div>

                        {/* Occupancy Indicator */}
                        <div className="unit-occupancy-row">
                          {isVacant ? (
                            <span className="occ-badge occ-vacant">Boş</span>
                          ) : isOccupiedOwner ? (
                            <span className="occ-badge occ-owner">Malik</span>
                          ) : (
                            <span className="occ-badge occ-tenant">Kiracı</span>
                          )}

                          {unit.primaryResidentName && (
                            <span className="primary-resident-compact" title={unit.primaryResidentName}>
                              {unit.primaryResidentName}
                            </span>
                          )}

                          {unit.activeResidentCount > 1 && (
                            <span className="resident-count-pill">+{unit.activeResidentCount}</span>
                          )}
                        </div>

                        {/* Status Warning Badges Group */}
                        <div className="unit-card-indicators">
                          {unit.hasOverdueDebt ? (
                            <span className="indicator-pill ind-overdue" title={`Gecikmiş Borç: ${formatCurrency(unit.outstandingBalance)}`}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              ₺ Gecikmiş
                            </span>
                          ) : unit.outstandingBalance > 0 ? (
                            <span className="indicator-pill ind-debt" title={`Bakiye: ${formatCurrency(unit.outstandingBalance)}`}>
                              ₺ {formatCurrency(unit.outstandingBalance)}
                            </span>
                          ) : null}

                          {unit.openMaintenanceRequestCount > 0 && (
                            <span className={`indicator-pill ${maintBadgeClass}`} title={`Bakım: ${unit.openMaintenanceRequestCount} adet`}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                              </svg>
                              {maintLabel} ({unit.openMaintenanceRequestCount})
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Unit Detail Drawer */}
      {isDrawerOpen && selectedUnit && (
        <>
          <button
            className="drawer-backdrop drawer-open"
            type="button"
            aria-label="Daire detayını kapat"
            onClick={handleCloseDrawer}
          />
          <aside
            className="management-drawer unit-detail-drawer drawer-open"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-drawer-title"
          >
            <div className="drawer-header">
              <div className="drawer-title-group">
                <div className="unit-drawer-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div>
                  <h2 id="unit-drawer-title">Daire {selectedUnit.unitNumber}</h2>
                  <p className="drawer-subtitle">{selectedUnit.unitTypeName} • {selectedUnit.floorNumber === 0 ? 'Zemin Kat' : `${selectedUnit.floorNumber}. Kat`}</p>
                </div>
              </div>

              <div className="drawer-header-actions">
                <span className={`occ-badge ${selectedUnit.occupancyStatus === 'VACANT' ? 'occ-vacant' : selectedUnit.occupancyStatus === 'OCCUPIED_OWNER' ? 'occ-owner' : 'occ-tenant'}`}>
                  {selectedUnit.occupancyStatus === 'VACANT' ? 'Boş' : selectedUnit.occupancyStatus === 'OCCUPIED_OWNER' ? 'Malik' : 'Kiracı'}
                </span>
                <button type="button" className="btn-close" onClick={handleCloseDrawer} aria-label="Kapat">
                  ✕
                </button>
              </div>
            </div>

            <div className="drawer-body">
              {/* Section A: Daire Bilgileri */}
              <section className="drawer-section">
                <h3>Daire Bilgileri</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Site / Gayrimenkul</span>
                    <span className="detail-value">{floorMap?.propertyName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Bina / Blok</span>
                    <span className="detail-value">{floorMap?.buildingName} ({floorMap?.buildingCode})</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Kat</span>
                    <span className="detail-value">{selectedUnit.floorNumber === 0 ? 'Zemin Kat' : `${selectedUnit.floorNumber}. Kat`}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Daire No</span>
                    <span className="detail-value">{selectedUnit.unitNumber}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Daire Tipi</span>
                    <span className="detail-value">{selectedUnit.unitTypeName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Durum</span>
                    <span className="detail-value">{selectedUnit.isActive ? 'Aktif' : 'Pasif'}</span>
                  </div>
                </div>
              </section>

              {/* Section B: Doluluk Bilgisi */}
              <section className="drawer-section">
                <h3>Doluluk Bilgisi</h3>
                {selectedUnit.occupancyStatus === 'VACANT' ? (
                  <div className="drawer-empty-box">
                    <p>Bu dairede aktif sakin bulunmuyor.</p>
                  </div>
                ) : (
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Ana Sakin</span>
                      <span className="detail-value font-medium">{selectedUnit.primaryResidentName || 'Belirtilmedi'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">İkamet Türü</span>
                      <span className="detail-value">{selectedUnit.occupancyStatus === 'OCCUPIED_OWNER' ? 'Kat Maliki' : 'Kiracı'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Aktif Sakin Sayısı</span>
                      <span className="detail-value">{selectedUnit.activeResidentCount} kişi</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Section C: Finans Özeti */}
              <section className="drawer-section">
                <h3>Finans Özeti</h3>
                <div className="finance-drawer-summary">
                  <div className="finance-amount-row">
                    <span className="amount-label">Açık Bakiye</span>
                    <span className={`amount-value ${selectedUnit.hasOverdueDebt ? 'text-red' : selectedUnit.outstandingBalance > 0 ? 'text-amber' : 'text-green'}`}>
                      {formatCurrency(selectedUnit.outstandingBalance)}
                    </span>
                  </div>

                  {selectedUnit.hasOverdueDebt ? (
                    <div className="warning-banner banner-red">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>Gecikmiş borç bulunuyor. Ödeme süresi geçmiş aidat/gider kaydı mevcut.</span>
                    </div>
                  ) : selectedUnit.outstandingBalance > 0 ? (
                    <div className="warning-banner banner-amber">
                      <span>Vadesi henüz gelmemiş açık bakiye bulunmaktadır.</span>
                    </div>
                  ) : (
                    <div className="warning-banner banner-green">
                      <span>Borç yok. Tüm aidat ve giderler ödenmiştir.</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Section D: Bakım Özeti */}
              <section className="drawer-section">
                <h3>Bakım Özeti</h3>
                {selectedUnit.openMaintenanceRequestCount === 0 ? (
                  <div className="drawer-empty-box">
                    <p>Aktif bakım talebi bulunmuyor.</p>
                  </div>
                ) : (
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Aktif Talep Sayısı</span>
                      <span className="detail-value">{selectedUnit.openMaintenanceRequestCount} adet</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">En Yüksek Öncelik</span>
                      <span className="detail-value">
                        <span className={`occ-badge ${selectedUnit.maintenanceStatus === 'EMERGENCY' ? 'maint-emergency' : selectedUnit.maintenanceStatus === 'HIGH' ? 'maint-high' : 'maint-normal'}`}>
                          {selectedUnit.maintenanceStatus}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Quick Actions Footer */}
            <div className="drawer-footer">
              {onNavigateToUnit && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    handleCloseDrawer()
                    onNavigateToUnit(selectedUnit.unitId)
                  }}
                >
                  <span>Daire Detayını Gör</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </button>
              )}
              {onNavigateToMaintenance && selectedUnit.openMaintenanceRequestCount > 0 && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    handleCloseDrawer()
                    onNavigateToMaintenance(selectedUnit.unitId)
                  }}
                >
                  <span>Bakım Taleplerini Gör ({selectedUnit.openMaintenanceRequestCount})</span>
                </button>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
