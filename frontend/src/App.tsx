import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  createBuilding,
  createProperty,
  createUnit,
  deactivateProperty,
  deleteBuilding,
  deleteUnit,
  getBuildingsByProperty,
  getProperties,
  getPropertyTypes,
  getUnitsByBuilding,
  getUnitTypes,
  updateBuilding,
  updateProperty,
  updateUnit,
} from './api'
import { SearchableSelect } from './components/SearchableSelect'
import { TURKEY_CITIES } from './data/turkeyLocations'
import type {
  Building,
  CreateBuildingPayload,
  CreatePropertyPayload,
  CreateUnitPayload,
  Property,
  PropertyType,
  Unit,
  UnitType,
  UpdateBuildingPayload,
  UpdatePropertyPayload,
  UpdateUnitPayload,
} from './types'

const initialPropertyForm: CreatePropertyPayload & { id?: number; isActive?: boolean } = {
  name: '',
  propertyTypeId: null,
  addressLine: '',
  city: '',
  district: '',
  description: '',
  isActive: true,
}

const initialBuildingForm: CreateBuildingPayload & { id?: number; isActive?: boolean } = {
  propertyId: 0,
  name: '',
  code: '',
  floorCount: 1,
  description: '',
  isActive: true,
}

const initialUnitForm: CreateUnitPayload & { id?: number; isActive?: boolean } = {
  buildingId: 0,
  unitTypeId: 0,
  unitNumber: '',
  floorNumber: 0,
  grossArea: null,
  netArea: null,
  description: '',
  isActive: true,
}

function App() {
  // Lookups
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([])
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])

  // Main lists
  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [units, setUnits] = useState<Unit[]>([])

  // Selections
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)

  // Single Apartment Setup State
  const [singleApartmentFloorCount, setSingleApartmentFloorCount] = useState(1)

  // Forms
  const [propertyForm, setPropertyForm] = useState(initialPropertyForm)
  const [buildingForm, setBuildingForm] = useState(initialBuildingForm)
  const [unitForm, setUnitForm] = useState(initialUnitForm)

  // Edit Modes
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(null)
  const [editingBuildingId, setEditingBuildingId] = useState<number | null>(null)
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null)

  // UI Status
  const [isLoadingProperties, setIsLoadingProperties] = useState(true)
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(false)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  const [isSubmittingProperty, setIsSubmittingProperty] = useState(false)
  const [isSubmittingBuilding, setIsSubmittingBuilding] = useState(false)
  const [isSubmittingUnit, setIsSubmittingUnit] = useState(false)

  const [propertyError, setPropertyError] = useState('')
  const [buildingError, setBuildingError] = useState('')
  const [unitError, setUnitError] = useState('')

  // Section references for smooth scrolling & accessibility
  const buildingSectionRef = useRef<HTMLElement>(null)
  const unitSectionRef = useRef<HTMLElement>(null)

  // City & District options calculation
  const cityNames = TURKEY_CITIES.map((c) => c.name)
  const selectedCityObj = TURKEY_CITIES.find((c) => c.name === propertyForm.city)
  const availableDistricts = selectedCityObj ? selectedCityObj.districts : []

  // Check if selected property is a Single Apartment
  const isSingleApartment =
    selectedProperty != null &&
    (selectedProperty.propertyType === 'SINGLE_APARTMENT' ||
      selectedProperty.propertyType === 'Apartman' ||
      selectedProperty.propertyTypeName === 'Apartman' ||
      propertyTypes.find((pt) => pt.id === selectedProperty.propertyTypeId)?.code === 'SINGLE_APARTMENT')

  // 1. Initial Load: PropertyTypes, UnitTypes, Properties
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingProperties(true)
      setPropertyError('')
      try {
        const [ptData, utData, propData] = await Promise.all([
          getPropertyTypes(false),
          getUnitTypes(false),
          getProperties(true),
        ])
        setPropertyTypes(ptData)
        setUnitTypes(utData)
        setProperties(propData)
      } catch (err) {
        setPropertyError(err instanceof Error ? err.message : 'Veriler yüklenirken bir hata oluştu.')
      } finally {
        setIsLoadingProperties(false)
      }
    }

    loadInitialData()
  }, [])

  // 2. Fetch Buildings when a Property is selected
  useEffect(() => {
    if (!selectedProperty) {
      setBuildings([])
      setSelectedBuilding(null)
      setUnits([])
      return
    }

    const loadBuildings = async () => {
      setIsLoadingBuildings(true)
      setBuildingError('')
      try {
        const data = await getBuildingsByProperty(selectedProperty.id, true)
        setBuildings(data)

        // Single Apartment auto-select if building exists
        if (
          selectedProperty &&
          data.length > 0 &&
          (selectedProperty.propertyType === 'SINGLE_APARTMENT' ||
            selectedProperty.propertyType === 'Apartman' ||
            selectedProperty.propertyTypeName === 'Apartman')
        ) {
          setSelectedBuilding(data[0])
        }
      } catch (err) {
        setBuildingError(err instanceof Error ? err.message : 'Bina listesi yüklenemedi.')
      } finally {
        setIsLoadingBuildings(false)
      }
    }

    loadBuildings()
  }, [selectedProperty])

  // 3. Fetch Units when a Building is selected
  useEffect(() => {
    if (!selectedBuilding) {
      setUnits([])
      return
    }

    const loadUnits = async () => {
      setIsLoadingUnits(true)
      setUnitError('')
      try {
        const data = await getUnitsByBuilding(selectedBuilding.id, true)
        setUnits(data)
      } catch (err) {
        setUnitError(err instanceof Error ? err.message : 'Bağımsız bölüm listesi yüklenemedi.')
      } finally {
        setIsLoadingUnits(false)
      }
    }

    loadUnits()
  }, [selectedBuilding])

  // ==========================================
  // PROPERTY HANDLERS
  // ==========================================
  const handleCityChange = (newCity: string) => {
    const cityObj = TURKEY_CITIES.find((c) => c.name === newCity)
    const validDistricts = cityObj ? cityObj.districts : []
    const isCurrentDistrictValid = validDistricts.includes(propertyForm.district)

    setPropertyForm((prev) => ({
      ...prev,
      city: newCity,
      district: isCurrentDistrictValid ? prev.district : '',
    }))
  }

  const handleDistrictChange = (newDistrict: string) => {
    setPropertyForm((prev) => ({
      ...prev,
      district: newDistrict,
    }))
  }

  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property)
    setSelectedBuilding(null)
    setUnits([])
    setBuildingForm({ ...initialBuildingForm, propertyId: property.id })
    setEditingBuildingId(null)
    setBuildingError('')

    // Smooth scroll to Building section for better UX
    setTimeout(() => {
      buildingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleClearPropertySelection = () => {
    setSelectedProperty(null)
    setSelectedBuilding(null)
    setBuildings([])
    setUnits([])
    setEditingBuildingId(null)
    setEditingUnitId(null)
  }

  const handleEditPropertyClick = (property: Property) => {
    setEditingPropertyId(property.id)
    setPropertyForm({
      name: property.name,
      propertyTypeId: property.propertyTypeId || (propertyTypes.find((pt) => pt.name === property.propertyType)?.id ?? null),
      addressLine: property.addressLine,
      city: property.city,
      district: property.district,
      description: property.description || '',
      isActive: property.isActive,
    })
    setPropertyError('')
  }

  const handleCancelPropertyEdit = () => {
    setEditingPropertyId(null)
    setPropertyForm(initialPropertyForm)
    setPropertyError('')
  }

  const handlePropertySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPropertyError('')

    // Validation: City and District must be valid
    const matchedCity = TURKEY_CITIES.find((c) => c.name.toLowerCase() === propertyForm.city.trim().toLowerCase())
    if (!matchedCity) {
      setPropertyError('Lütfen listeden geçerli bir şehir seçiniz.')
      return
    }

    const matchedDistrict = matchedCity.districts.find(
      (d) => d.toLowerCase() === propertyForm.district.trim().toLowerCase()
    )
    if (!matchedDistrict) {
      setPropertyError(`Lütfen ${matchedCity.name} ili için geçerli bir ilçe seçiniz.`)
      return
    }

    setIsSubmittingProperty(true)

    try {
      if (editingPropertyId) {
        const payload: UpdatePropertyPayload = {
          name: propertyForm.name,
          propertyTypeId: propertyForm.propertyTypeId ? Number(propertyForm.propertyTypeId) : null,
          addressLine: propertyForm.addressLine,
          city: matchedCity.name,
          district: matchedDistrict,
          description: propertyForm.description || null,
          isActive: propertyForm.isActive ?? true,
        }
        const updated = await updateProperty(editingPropertyId, payload)
        setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        if (selectedProperty?.id === updated.id) {
          setSelectedProperty(updated)
        }
        setEditingPropertyId(null)
      } else {
        const payload: CreatePropertyPayload = {
          name: propertyForm.name,
          propertyTypeId: propertyForm.propertyTypeId ? Number(propertyForm.propertyTypeId) : null,
          addressLine: propertyForm.addressLine,
          city: matchedCity.name,
          district: matchedDistrict,
          description: propertyForm.description || null,
        }
        const created = await createProperty(payload)
        setProperties((prev) => [...prev, created])
      }
      setPropertyForm(initialPropertyForm)
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : 'Gayrimenkul kaydedilemedi.')
    } finally {
      setIsSubmittingProperty(false)
    }
  }

  const handleDeactivateProperty = async (id: number) => {
    if (!window.confirm('Bu gayrimenkulü pasifleştirmek istediğinizden emin misiniz?')) {
      return
    }
    try {
      await deactivateProperty(id)
      const updatedList = await getProperties(true)
      setProperties(updatedList)
      if (selectedProperty?.id === id) {
        const updatedProp = updatedList.find((p) => p.id === id)
        if (updatedProp) setSelectedProperty(updatedProp)
      }
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : 'Gayrimenkul pasifleştirilemedi.')
    }
  }

  // ==========================================
  // BUILDING HANDLERS
  // ==========================================
  const handleSelectBuilding = (building: Building) => {
    setSelectedBuilding(building)
    setUnitForm({ ...initialUnitForm, buildingId: building.id, unitTypeId: unitTypes[0]?.id || 0 })
    setEditingUnitId(null)
    setUnitError('')

    // Smooth scroll to Unit section for better UX
    setTimeout(() => {
      unitSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleClearBuildingSelection = () => {
    setSelectedBuilding(null)
    setUnits([])
    setEditingUnitId(null)
  }

  const handleEditBuildingClick = (building: Building) => {
    setEditingBuildingId(building.id)
    setBuildingForm({
      propertyId: building.propertyId,
      name: building.name,
      code: building.code,
      floorCount: building.floorCount,
      description: building.description || '',
      isActive: building.isActive,
    })
    setBuildingError('')
  }

  const handleCancelBuildingEdit = () => {
    setEditingBuildingId(null)
    setBuildingForm({ ...initialBuildingForm, propertyId: selectedProperty?.id || 0 })
    setBuildingError('')
  }

  const handleBuildingSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProperty) return

    setIsSubmittingBuilding(true)
    setBuildingError('')

    try {
      if (editingBuildingId) {
        const payload: UpdateBuildingPayload = {
          propertyId: selectedProperty.id,
          name: buildingForm.name,
          code: buildingForm.code,
          floorCount: Number(buildingForm.floorCount),
          description: buildingForm.description || null,
          isActive: buildingForm.isActive ?? true,
        }
        const updated = await updateBuilding(editingBuildingId, payload)
        setBuildings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
        if (selectedBuilding?.id === updated.id) {
          setSelectedBuilding(updated)
        }
        setEditingBuildingId(null)
      } else {
        const payload: CreateBuildingPayload = {
          propertyId: selectedProperty.id,
          name: buildingForm.name,
          code: buildingForm.code,
          floorCount: Number(buildingForm.floorCount),
          description: buildingForm.description || null,
        }
        const created = await createBuilding(payload)
        setBuildings((prev) => [...prev, created])
      }
      setBuildingForm({ ...initialBuildingForm, propertyId: selectedProperty.id })
    } catch (err) {
      setBuildingError(err instanceof Error ? err.message : 'Bina kaydedilemedi.')
    } finally {
      setIsSubmittingBuilding(false)
    }
  }

  const handleCreateSingleApartmentBuilding = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProperty) return

    setIsSubmittingBuilding(true)
    setBuildingError('')

    try {
      const payload: CreateBuildingPayload = {
        propertyId: selectedProperty.id,
        name: selectedProperty.name,
        code: 'MAIN_BUILDING',
        floorCount: Number(singleApartmentFloorCount),
        description: 'Teknik bina kaydı',
      }
      const created = await createBuilding(payload)
      setBuildings([created])
      handleSelectBuilding(created)
    } catch (err) {
      setBuildingError(err instanceof Error ? err.message : 'Apartman yapısı oluşturulamadı.')
    } finally {
      setIsSubmittingBuilding(false)
    }
  }

  const handleDeleteBuildingClick = async (id: number) => {
    if (!window.confirm('Bu binayı silmek istediğinizden emin misiniz?')) {
      return
    }
    try {
      await deleteBuilding(id)
      setBuildings((prev) => prev.filter((b) => b.id !== id))
      if (selectedBuilding?.id === id) {
        setSelectedBuilding(null)
        setUnits([])
      }
    } catch (err) {
      setBuildingError(err instanceof Error ? err.message : 'Bina silinemedi.')
    }
  }

  // ==========================================
  // UNIT HANDLERS
  // ==========================================
  const handleEditUnitClick = (unit: Unit) => {
    setEditingUnitId(unit.id)
    setUnitForm({
      buildingId: unit.buildingId,
      unitTypeId: unit.unitTypeId,
      unitNumber: unit.unitNumber,
      floorNumber: unit.floorNumber,
      grossArea: unit.grossArea,
      netArea: unit.netArea,
      description: unit.description || '',
      isActive: unit.isActive,
    })
    setUnitError('')
  }

  const handleCancelUnitEdit = () => {
    setEditingUnitId(null)
    setUnitForm({
      ...initialUnitForm,
      buildingId: selectedBuilding?.id || 0,
      unitTypeId: unitTypes[0]?.id || 0,
    })
    setUnitError('')
  }

  const handleUnitSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedBuilding) return

    // Frontend validation: NetArea <= GrossArea
    if (unitForm.grossArea != null && unitForm.netArea != null) {
      const gross = Number(unitForm.grossArea)
      const net = Number(unitForm.netArea)
      if (net > gross) {
        setUnitError('Net alan brüt alandan büyük olamaz.')
        return
      }
    }

    setIsSubmittingUnit(true)
    setUnitError('')

    try {
      if (editingUnitId) {
        const payload: UpdateUnitPayload = {
          buildingId: selectedBuilding.id,
          unitTypeId: Number(unitForm.unitTypeId),
          unitNumber: unitForm.unitNumber,
          floorNumber: Number(unitForm.floorNumber),
          grossArea: unitForm.grossArea ? Number(unitForm.grossArea) : null,
          netArea: unitForm.netArea ? Number(unitForm.netArea) : null,
          description: unitForm.description || null,
          isActive: unitForm.isActive ?? true,
        }
        const updated = await updateUnit(editingUnitId, payload)
        setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
        setEditingUnitId(null)
      } else {
        const payload: CreateUnitPayload = {
          buildingId: selectedBuilding.id,
          unitTypeId: Number(unitForm.unitTypeId),
          unitNumber: unitForm.unitNumber,
          floorNumber: Number(unitForm.floorNumber),
          grossArea: unitForm.grossArea ? Number(unitForm.grossArea) : null,
          netArea: unitForm.netArea ? Number(unitForm.netArea) : null,
          description: unitForm.description || null,
        }
        const created = await createUnit(payload)
        setUnits((prev) => [...prev, created])
      }
      setUnitForm({
        ...initialUnitForm,
        buildingId: selectedBuilding.id,
        unitTypeId: unitTypes[0]?.id || 0,
      })
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'Bağımsız bölüm kaydedilemedi.')
    } finally {
      setIsSubmittingUnit(false)
    }
  }

  const handleDeleteUnitClick = async (id: number) => {
    if (!window.confirm('Bu bağımsız bölümü silmek istediğinizden emin misiniz?')) {
      return
    }
    try {
      await deleteUnit(id)
      setUnits((prev) => prev.filter((u) => u.id !== id))
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'Bağımsız bölüm silinemedi.')
    }
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Phase 3 — Property Structure Integration</p>
        <h1>Residential Management System</h1>
        <p className="page-description">
          Gayrimenkul, bina/blok ve bağımsız bölüm hiyerarşisini tek bir yönetim paneli üzerinden yönetin.
        </p>

        {/* Selection Breadcrumbs */}
        <div className="selection-breadcrumbs">
          <div
            className={`breadcrumb-item ${selectedProperty ? 'active' : ''}`}
            onClick={() => selectedProperty && buildingSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span>1. Gayrimenkul:</span>
            <strong>{selectedProperty ? selectedProperty.name : 'Seçilmedi'}</strong>
            {selectedProperty && (
              <button
                className="text-button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearPropertySelection()
                }}
              >
                Değiştir
              </button>
            )}
          </div>

          <div
            className={`breadcrumb-item ${selectedBuilding ? 'active' : ''}`}
            onClick={() => selectedBuilding && unitSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span>2. Bina / Blok:</span>
            <strong>{selectedBuilding ? `${selectedBuilding.name} (${selectedBuilding.code})` : 'Seçilmedi'}</strong>
            {selectedBuilding && (
              <button
                className="text-button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearBuildingSelection()
                }}
              >
                Değiştir
              </button>
            )}
          </div>
        </div>
      </header>

      {/* SECTION 1: PROPERTIES */}
      <section className="section-container">
        <div className="content-grid">
          {/* Property Form */}
          <section className="panel">
            <div className="section-heading">
              <h2>{editingPropertyId ? 'Gayrimenkulü Düzenle' : 'Yeni Gayrimenkul Ekle'}</h2>
              <p>Site, apartman veya ticari kompleks kaydı oluşturun veya güncelleyin.</p>
            </div>

            {propertyError && <p className="status-message error-message">{propertyError}</p>}

            <form className="property-form" onSubmit={handlePropertySubmit}>
              <div className="form-field form-field-full">
                <label htmlFor="prop-name">Gayrimenkul Adı *</label>
                <input
                  id="prop-name"
                  value={propertyForm.name}
                  onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                  placeholder="Örn: Olbia Residence"
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label htmlFor="prop-type">Gayrimenkul Türü *</label>
                <select
                  id="prop-type"
                  value={propertyForm.propertyTypeId || ''}
                  onChange={(e) =>
                    setPropertyForm({
                      ...propertyForm,
                      propertyTypeId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  required
                >
                  <option value="">-- Tür Seçiniz --</option>
                  {propertyTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name} ({pt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field form-field-full">
                <label htmlFor="prop-address">Adres *</label>
                <input
                  id="prop-address"
                  value={propertyForm.addressLine}
                  onChange={(e) => setPropertyForm({ ...propertyForm, addressLine: e.target.value })}
                  placeholder="Cadde, sokak, no"
                  required
                />
              </div>

              <div className="form-field">
                <SearchableSelect
                  id="prop-city"
                  label="İl"
                  value={propertyForm.city}
                  options={cityNames}
                  placeholder="İl ara veya seç"
                  required
                  onChange={handleCityChange}
                />
              </div>

              <div className="form-field">
                <SearchableSelect
                  id="prop-district"
                  label="İlçe"
                  value={propertyForm.district}
                  options={availableDistricts}
                  placeholder="İlçe ara veya seç"
                  disabled={!propertyForm.city}
                  required
                  onChange={handleDistrictChange}
                />
              </div>

              <div className="form-field form-field-full">
                <label htmlFor="prop-desc">Açıklama</label>
                <textarea
                  id="prop-desc"
                  value={propertyForm.description || ''}
                  onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                  placeholder="İsteğe bağlı açıklama"
                  rows={3}
                />
              </div>

              {editingPropertyId && (
                <div className="form-field form-field-full checkbox-field">
                  <label htmlFor="prop-is-active">
                    <input
                      id="prop-is-active"
                      type="checkbox"
                      checked={propertyForm.isActive ?? true}
                      onChange={(e) => setPropertyForm({ ...propertyForm, isActive: e.target.checked })}
                    />
                    <span>Aktif Kayıt</span>
                  </label>
                </div>
              )}

              <div className="button-group form-field-full">
                <button className="primary-button" type="submit" disabled={isSubmittingProperty}>
                  {isSubmittingProperty
                    ? 'Kaydediliyor...'
                    : editingPropertyId
                    ? 'Güncelle'
                    : 'Gayrimenkul Ekle'}
                </button>
                {editingPropertyId && (
                  <button className="secondary-button" type="button" onClick={handleCancelPropertyEdit}>
                    İptal
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Property List */}
          <section className="panel">
            <div className="section-heading">
              <h2>Gayrimenkuller</h2>
              <p>{properties.length} kayıt bulundu. Birini seçerek binalarını yönetin.</p>
            </div>

            {isLoadingProperties && <p className="status-message">Yükleniyor...</p>}

            {!isLoadingProperties && properties.length === 0 && (
              <p className="status-message">Henüz kayıtlı gayrimenkul bulunmamaktadır.</p>
            )}

            <div className="card-list">
              {properties.map((prop) => {
                const isSelected = selectedProperty?.id === prop.id
                return (
                  <article
                    className={`item-card ${isSelected ? 'selected-card' : ''}`}
                    key={prop.id}
                  >
                    <div className="card-header">
                      <div>
                        <h3>{prop.name}</h3>
                        <p className="subtitle">{prop.propertyTypeName || prop.propertyType}</p>
                      </div>

                      <span className={`status-badge ${prop.isActive ? 'active' : 'inactive'}`}>
                        {prop.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>

                    <p className="location-text">
                      {prop.city} / {prop.district}
                    </p>
                    <p className="address-text">{prop.addressLine}</p>
                    {prop.description && <p className="desc-text">{prop.description}</p>}

                    <div className="card-actions">
                      <button
                        className={`action-button ${isSelected ? 'active-select' : 'select-btn'}`}
                        onClick={() => handleSelectProperty(prop)}
                      >
                        {isSelected ? '✓ Seçili Gayrimenkul' : 'Yönet →'}
                      </button>

                      <button
                        className="action-button edit-btn"
                        onClick={() => handleEditPropertyClick(prop)}
                      >
                        Düzenle
                      </button>

                      {prop.isActive && (
                        <button
                          className="action-button danger-btn"
                          onClick={() => handleDeactivateProperty(prop.id)}
                        >
                          Pasifleştir
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </section>

      {/* SECTION 2: BUILDINGS (Requires Selected Property) */}
      {selectedProperty && (
        <section
          ref={buildingSectionRef}
          className="section-container highlight-section"
          id="buildings-section"
        >
          <div className="section-header-banner">
            <div>
              <h2>{isSingleApartment ? 'Apartman Yapısı' : 'Binalar / Bloklar'}</h2>
              <p>
                Seçili Gayrimenkul: <strong>{selectedProperty.name}</strong>{' '}
                {!selectedProperty.isActive && (
                  <span className="passive-notice">(Pasif Kayıt)</span>
                )}
              </p>
            </div>
            <button className="secondary-button" onClick={handleClearPropertySelection}>
              ← Gayrimenkul Seçimine Dön
            </button>
          </div>

          {/* SINGLE APARTMENT SPECIAL FLOW */}
          {isSingleApartment ? (
            <div className="panel single-apartment-panel">
              {buildings.length === 0 ? (
                !selectedProperty.isActive ? (
                  <div>
                    <div className="section-heading">
                      <h2>Apartman Yapısı Hazırlanamıyor</h2>
                    </div>

                    <p className="status-message empty-state-box">
                      Bu apartman pasif durumdadır. Bina yapısını hazırlamak ve bağımsız bölüm eklemek için önce yukarıdaki listeden gayrimenkulün "Düzenle" butonuna tıklayarak aktifleştirin.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="section-heading">
                      <h2>Apartman Yapısını Hazırla</h2>
                      <p>
                        "{selectedProperty.name}" tek bir apartmandır. Bölümleri yönetebilmek için lütfen binanın gerçek kat sayısını girip onaylayınız.
                      </p>
                    </div>

                    {buildingError && <p className="status-message error-message">{buildingError}</p>}

                    <form className="property-form" onSubmit={handleCreateSingleApartmentBuilding}>
                      <div className="form-field">
                        <label htmlFor="single-floor">Kat Sayısı (1-200) *</label>
                        <input
                          id="single-floor"
                          type="number"
                          min={1}
                          max={200}
                          value={singleApartmentFloorCount}
                          onChange={(e) => setSingleApartmentFloorCount(Number(e.target.value))}
                          required
                        />
                      </div>

                      <div className="button-group form-field-full" style={{ marginTop: '12px' }}>
                        <button className="primary-button" type="submit" disabled={isSubmittingBuilding}>
                          {isSubmittingBuilding ? 'Hazırlanıyor...' : 'Apartman Yapısını Oluştur ve Bölümlere Geç →'}
                        </button>
                      </div>
                    </form>
                  </div>
                )
              ) : (
                <div>
                  <div className="section-heading">
                    <h2>Tek Apartman Kaydı Hazır</h2>
                    <p>
                      <strong>{buildings[0].name}</strong> ({buildings[0].floorCount} Kat) için bağımsız bölüm yönetimi aktifleştirildi. Aşağıdaki bölümden daire veya dükkan ekleyebilirsiniz.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* RESIDENTIAL COMPLEX / COMMERCIAL / MIXED USE REGULAR FLOW */
            <div className="content-grid">
              {/* Building Form */}
              <section className="panel">
                <div className="section-heading">
                  <h2>{editingBuildingId ? 'Binayı Düzenle' : 'Yeni Bina / Blok Ekle'}</h2>
                  <p>"{selectedProperty.name}" altına bina veya blok kaydedin.</p>
                </div>

                {buildingError && <p className="status-message error-message">{buildingError}</p>}

                <form className="property-form" onSubmit={handleBuildingSubmit}>
                  <div className="form-field">
                    <label htmlFor="bld-name">Bina / Blok Adı *</label>
                    <input
                      id="bld-name"
                      value={buildingForm.name}
                      onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                      placeholder="Örn: A Blok"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="bld-code">Bina Kodu *</label>
                    <input
                      id="bld-code"
                      value={buildingForm.code}
                      onChange={(e) => setBuildingForm({ ...buildingForm, code: e.target.value })}
                      placeholder="Örn: A_BLOK"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="bld-floor">Kat Sayısı (1-200) *</label>
                    <input
                      id="bld-floor"
                      type="number"
                      min={1}
                      max={200}
                      value={buildingForm.floorCount}
                      onChange={(e) => setBuildingForm({ ...buildingForm, floorCount: Number(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="form-field form-field-full">
                    <label htmlFor="bld-desc">Açıklama</label>
                    <textarea
                      id="bld-desc"
                      value={buildingForm.description || ''}
                      onChange={(e) => setBuildingForm({ ...buildingForm, description: e.target.value })}
                      placeholder="İsteğe bağlı bina açıklaması"
                      rows={2}
                    />
                  </div>

                  {editingBuildingId && (
                    <div className="form-field form-field-full checkbox-field">
                      <label htmlFor="bld-is-active">
                        <input
                          id="bld-is-active"
                          type="checkbox"
                          checked={buildingForm.isActive ?? true}
                          onChange={(e) => setBuildingForm({ ...buildingForm, isActive: e.target.checked })}
                        />
                        <span>Aktif Bina</span>
                      </label>
                    </div>
                  )}

                  <div className="button-group form-field-full">
                    <button className="primary-button" type="submit" disabled={isSubmittingBuilding}>
                      {isSubmittingBuilding
                        ? 'Kaydediliyor...'
                        : editingBuildingId
                        ? 'Güncelle'
                        : 'Bina Ekle'}
                    </button>
                    {editingBuildingId && (
                      <button className="secondary-button" type="button" onClick={handleCancelBuildingEdit}>
                        İptal
                      </button>
                    )}
                  </div>
                </form>
              </section>

              {/* Building List */}
              <section className="panel">
                <div className="section-heading">
                  <h2>Bina Listesi</h2>
                  <p>{buildings.length} bina bulundu. Birini seçerek bağımsız bölümlerini yönetin.</p>
                </div>

                {isLoadingBuildings && <p className="status-message">Binalar yükleniyor...</p>}

                {!isLoadingBuildings && buildings.length === 0 && (
                  <p className="status-message empty-state-box">
                    Bu gayrimenkule ait henüz bina/blok bulunmuyor. Sol taraftaki formu kullanarak ilk binayı ekleyebilirsiniz.
                  </p>
                )}

                <div className="card-list">
                  {buildings.map((bld) => {
                    const isSelected = selectedBuilding?.id === bld.id
                    return (
                      <article
                        className={`item-card ${isSelected ? 'selected-card' : ''}`}
                        key={bld.id}
                      >
                        <div className="card-header">
                          <div>
                            <h3>{bld.name}</h3>
                            <p className="subtitle">Kod: <code>{bld.code}</code> | {bld.floorCount} Kat</p>
                          </div>

                          <span className={`status-badge ${bld.isActive ? 'active' : 'inactive'}`}>
                            {bld.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </div>

                        {bld.description && <p className="desc-text">{bld.description}</p>}

                        <div className="card-actions">
                          <button
                            className={`action-button ${isSelected ? 'active-select' : 'select-btn'}`}
                            onClick={() => handleSelectBuilding(bld)}
                          >
                            {isSelected ? '✓ Seçili Bina' : 'Bölümleri Yönet →'}
                          </button>

                          <button
                            className="action-button edit-btn"
                            onClick={() => handleEditBuildingClick(bld)}
                          >
                            Düzenle
                          </button>

                          <button
                            className="action-button danger-btn"
                            onClick={() => handleDeleteBuildingClick(bld.id)}
                          >
                            Sil
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            </div>
          )}
        </section>
      )}

      {/* SECTION 3: UNITS (Requires Selected Building) */}
      {selectedBuilding && (
        <section
          ref={unitSectionRef}
          className="section-container highlight-section-units"
          id="units-section"
        >
          <div className="section-header-banner">
            <div>
              <h2>Bağımsız Bölümler (Daire, Dükkan, vb.)</h2>
              <p>Seçili Bina: <strong>{selectedBuilding.name}</strong> ({selectedProperty?.name})</p>
            </div>
            <button className="secondary-button" onClick={handleClearBuildingSelection}>
              ← Bina Seçimine Dön
            </button>
          </div>

          <div className="content-grid">
            {/* Unit Form */}
            <section className="panel">
              <div className="section-heading">
                <h2>{editingUnitId ? 'Bölümü Düzenle' : 'Yeni Bağımsız Bölüm Ekle'}</h2>
                <p>"{selectedBuilding.name}" altına daire, dükkan veya depo ekleyin.</p>
              </div>

              {unitError && <p className="status-message error-message">{unitError}</p>}

              <form className="property-form" onSubmit={handleUnitSubmit}>
                <div className="form-field">
                  <label htmlFor="unit-number">Kapı / Bölüm No *</label>
                  <input
                    id="unit-number"
                    value={unitForm.unitNumber}
                    onChange={(e) => setUnitForm({ ...unitForm, unitNumber: e.target.value })}
                    placeholder="Örn: Daire 1, D:12"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="unit-type">Bölüm Türü *</label>
                  <select
                    id="unit-type"
                    value={unitForm.unitTypeId || ''}
                    onChange={(e) => setUnitForm({ ...unitForm, unitTypeId: Number(e.target.value) })}
                    required
                  >
                    <option value="">-- Tür Seçiniz --</option>
                    {unitTypes.map((ut) => (
                      <option key={ut.id} value={ut.id}>
                        {ut.name} ({ut.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="unit-floor">Kat No (Bodrum için negatif) *</label>
                  <input
                    id="unit-floor"
                    type="number"
                    value={unitForm.floorNumber}
                    onChange={(e) => setUnitForm({ ...unitForm, floorNumber: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="unit-gross">Brüt Alan (m²)</label>
                  <input
                    id="unit-gross"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={unitForm.grossArea ?? ''}
                    onChange={(e) =>
                      setUnitForm({
                        ...unitForm,
                        grossArea: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Örn: 100.00"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="unit-net">Net Alan (m²)</label>
                  <input
                    id="unit-net"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={unitForm.netArea ?? ''}
                    onChange={(e) =>
                      setUnitForm({
                        ...unitForm,
                        netArea: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Örn: 85.50"
                  />
                </div>

                <div className="form-field form-field-full">
                  <label htmlFor="unit-desc">Açıklama</label>
                  <textarea
                    id="unit-desc"
                    value={unitForm.description || ''}
                    onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                    placeholder="İsteğe bağlı açıklama"
                    rows={2}
                  />
                </div>

                {editingUnitId && (
                  <div className="form-field form-field-full checkbox-field">
                    <label htmlFor="unit-is-active">
                      <input
                        id="unit-is-active"
                        type="checkbox"
                        checked={unitForm.isActive ?? true}
                        onChange={(e) => setUnitForm({ ...unitForm, isActive: e.target.checked })}
                      />
                      <span>Aktif Bölüm</span>
                    </label>
                  </div>
                )}

                <div className="button-group form-field-full">
                  <button className="primary-button" type="submit" disabled={isSubmittingUnit}>
                    {isSubmittingUnit
                      ? 'Kaydediliyor...'
                      : editingUnitId
                      ? 'Güncelle'
                      : 'Bölüm Ekle'}
                  </button>
                  {editingUnitId && (
                    <button className="secondary-button" type="button" onClick={handleCancelUnitEdit}>
                      İptal
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* Unit List */}
            <section className="panel">
              <div className="section-heading">
                <h2>Bölüm Listesi</h2>
                <p>{units.length} bağımsız bölüm bulundu.</p>
              </div>

              {isLoadingUnits && <p className="status-message">Bölümler yükleniyor...</p>}

              {!isLoadingUnits && units.length === 0 && (
                <p className="status-message empty-state-box">
                  Bu bina altında henüz kayıtlı bağımsız bölüm bulunmamaktadır. Sol taraftaki formu kullanarak ilk bölümü ekleyebilirsiniz.
                </p>
              )}

              <div className="card-list">
                {units.map((u) => (
                  <article className="item-card" key={u.id}>
                    <div className="card-header">
                      <div>
                        <h3>{u.unitNumber}</h3>
                        <p className="subtitle">
                          Tür: <strong>{u.unitTypeName}</strong> | Kat: {u.floorNumber}
                        </p>
                      </div>

                      <span className={`status-badge ${u.isActive ? 'active' : 'inactive'}`}>
                        {u.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>

                    <div className="area-info">
                      {u.grossArea != null && <span>Brüt: {u.grossArea} m²</span>}
                      {u.netArea != null && <span>Net: {u.netArea} m²</span>}
                    </div>

                    {u.description && <p className="desc-text">{u.description}</p>}

                    <div className="card-actions">
                      <button className="action-button edit-btn" onClick={() => handleEditUnitClick(u)}>
                        Düzenle
                      </button>

                      <button className="action-button danger-btn" onClick={() => handleDeleteUnitClick(u.id)}>
                        Sil
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
