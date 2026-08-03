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

import { Login } from './components/Login'
import { OccupancyManagement } from './components/OccupancyManagement'
import { SearchableSelect } from './components/SearchableSelect'
import { useAuth } from './context/AuthContext'
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

function slugifyBlockName(name: string): string {
  let str = name.trim()
  str = str.replace(/\s+(Blok|Bloğu|Block)$/i, '')
  const charMap: Record<string, string> = {
    'ç': 'C', 'Ç': 'C',
    'ğ': 'G', 'Ğ': 'G',
    'ı': 'I', 'I': 'I', 'İ': 'I',
    'ö': 'O', 'Ö': 'O',
    'ş': 'S', 'Ş': 'S',
    'ü': 'U', 'Ü': 'U',
  }
  str = str.replace(/[çÇğĞıIİöÖşŞüÜ]/g, (m) => charMap[m] || m)
  str = str.toUpperCase()
  str = str.replace(/[^A-Z0-9]/g, '-')
  str = str.replace(/-+/g, '-')
  str = str.replace(/^-|-$/g, '')
  return str
}

function formatFloorDisplay(floorNumber: number): string {
  const floor = Math.floor(Number(floorNumber))
  if (floor === 0) return 'Zemin Kat'
  if (floor < 0) return `Bodrum ${floor}`
  return `${floor}. Kat`
}

function formatUnitDisplay(unitNumber: string, unitTypeName?: string): string {
  const trimmed = unitNumber.trim()
  if (/^(Daire|Dükkan|Depo|Ofis|D:)/i.test(trimmed)) {
    return trimmed
  }
  if (unitTypeName) {
    return `${unitTypeName} ${trimmed}`
  }
  return trimmed
}

const PROPERTY_TYPE_LABEL_MAP: Record<string, string> = {
  SINGLE_APARTMENT: 'Tek Apartman',
  RESIDENTIAL_COMPLEX: 'Rezidans / Konut Sitesi',
  COMMERCIAL: 'Ticari Yapı',
  MIXED_USE: 'Karma Kullanım',
}

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
  const { user, isAuthenticated, loading, logout, hasRole, hasAnyRole } = useAuth()

  // Role permissions
  const canCreateProperty = hasAnyRole(['ADMIN', 'MANAGER'])
  const canEditProperty = hasAnyRole(['ADMIN', 'MANAGER'])
  const canDeleteProperty = hasRole('ADMIN')

  const canCreateBuilding = hasAnyRole(['ADMIN', 'MANAGER'])
  const canEditBuilding = hasAnyRole(['ADMIN', 'MANAGER'])
  const canDeleteBuilding = hasRole('ADMIN')

  const canCreateUnit = hasAnyRole(['ADMIN', 'MANAGER'])
  const canEditUnit = hasAnyRole(['ADMIN', 'MANAGER'])
  const canDeleteUnit = hasRole('ADMIN')
  const canManageOccupancies = hasAnyRole(['ADMIN', 'MANAGER'])

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
  const [selectedOccupancyUnit, setSelectedOccupancyUnit] = useState<Unit | null>(null)

  // Single Apartment Setup State
  const [singleApartmentFloorCount, setSingleApartmentFloorCount] = useState(1)

  // Block Code User Input Override Flag
  const [isBlockCodeUserEdited, setIsBlockCodeUserEdited] = useState(false)

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

  // Section Refs
  const buildingSectionRef = useRef<HTMLElement | null>(null)
  const unitSectionRef = useRef<HTMLElement | null>(null)
  const occupancySectionRef = useRef<HTMLDivElement | null>(null)

  // Computed Values
  const selectedPropertyTypeObj = propertyTypes.find(
    (pt) => pt.id === selectedProperty?.propertyTypeId
  )
  const isSingleApartment =
    selectedPropertyTypeObj?.code === 'SINGLE_APARTMENT' ||
    selectedProperty?.propertyType === 'SINGLE_APARTMENT'

  const selectableUnitTypes = unitTypes.filter((ut) => ut.code !== 'PARKING_SPACE')

  const cityNames = TURKEY_CITIES.map((c) => c.name)
  const matchedCity = TURKEY_CITIES.find(
    (c) => c.name.toLowerCase() === (propertyForm.city || '').toLowerCase()
  )
  const availableDistricts = matchedCity ? matchedCity.districts : []

  // Load Initial Lookups and Properties when authenticated
  useEffect(() => {
    if (!isAuthenticated) return

    const loadData = async () => {
      setIsLoadingProperties(true)
      try {
        const [propsData, propTypesData, unitTypesData] = await Promise.all([
          getProperties(true),
          getPropertyTypes(false),
          getUnitTypes(false),
        ])
        setProperties(propsData)
        setPropertyTypes(propTypesData)
        setUnitTypes(unitTypesData)

        if (propTypesData.length > 0) {
          setPropertyForm((prev) => ({ ...prev, propertyTypeId: propTypesData[0].id }))
        }
      } catch (err) {
        setPropertyError(err instanceof Error ? err.message : 'Veriler yüklenirken hata oluştu.')
      } finally {
        setIsLoadingProperties(false)
      }
    }

    loadData()
  }, [isAuthenticated])

  // Load Buildings when Property is Selected
  useEffect(() => {
    if (!selectedProperty) {
      setBuildings([])
      setSelectedBuilding(null)
      setUnits([])
      setSelectedOccupancyUnit(null)
      return
    }

    const loadBuildings = async () => {
      setIsLoadingBuildings(true)
      setBuildingError('')
      try {
        const data = await getBuildingsByProperty(selectedProperty.id, true)
        setBuildings(data)
        setBuildingForm({ ...initialBuildingForm, propertyId: selectedProperty.id })
        setIsBlockCodeUserEdited(false)

        if (selectedBuilding) {
          const updatedSelectedBuilding = data.find((b) => b.id === selectedBuilding.id)
          if (updatedSelectedBuilding) {
            setSelectedBuilding(updatedSelectedBuilding)
          } else {
            setSelectedBuilding(null)
            setUnits([])
            setSelectedOccupancyUnit(null)
          }
        }
      } catch (err) {
        setBuildingError(err instanceof Error ? err.message : 'Binalar yüklenemedi.')
      } finally {
        setIsLoadingBuildings(false)
      }
    }

    loadBuildings()
  }, [selectedProperty])

  // Load Units when Building is Selected
  useEffect(() => {
    if (!selectedBuilding) {
      setUnits([])
      setSelectedOccupancyUnit(null)
      return
    }

    const loadUnits = async () => {
      setIsLoadingUnits(true)
      setUnitError('')
      try {
        const data = await getUnitsByBuilding(selectedBuilding.id, true)
        setUnits(data)
        setSelectedOccupancyUnit((current) =>
          current ? data.find((unit) => unit.id === current.id) || null : null
        )
        setUnitForm({
          ...initialUnitForm,
          buildingId: selectedBuilding.id,
          unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
        })
      } catch (err) {
        setUnitError(err instanceof Error ? err.message : 'Bağımsız bölümler yüklenemedi.')
      } finally {
        setIsLoadingUnits(false)
      }
    }

    loadUnits()
  }, [selectedBuilding, unitTypes])

  // Automatic Single Apartment Building Selection
  useEffect(() => {
    if (isSingleApartment && buildings.length > 0) {
      const autoBuilding = buildings[0]
      if (selectedBuilding?.id !== autoBuilding.id) {
        setSelectedBuilding(autoBuilding)
        setUnitForm({
          ...initialUnitForm,
          buildingId: autoBuilding.id,
          unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
        })
      }
    }
  }, [isSingleApartment, buildings, selectedBuilding, unitTypes])

  if (loading) {
    return (
      <div className="login-container">
        <p className="status-message">Oturum kontrol ediliyor...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  // ==========================================
  // PROPERTY HANDLERS
  // ==========================================
  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property)
    setSelectedBuilding(null)
    setUnits([])
    setSelectedOccupancyUnit(null)
    setEditingBuildingId(null)
    setEditingUnitId(null)
    setPropertyError('')
    setBuildingError('')
    setUnitError('')

    setTimeout(() => {
      buildingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleClearPropertySelection = () => {
    setSelectedProperty(null)
    setSelectedBuilding(null)
    setBuildings([])
    setUnits([])
    setSelectedOccupancyUnit(null)
    setEditingBuildingId(null)
    setEditingUnitId(null)
    setPropertyError('')
    setBuildingError('')
    setUnitError('')
  }

  const handleCityChange = (newCity: string) => {
    setPropertyForm((prev) => ({
      ...prev,
      city: newCity,
      district: '',
    }))
  }

  const handleDistrictChange = (newDistrict: string) => {
    setPropertyForm((prev) => ({
      ...prev,
      district: newDistrict,
    }))
  }

  const handleEditPropertyClick = (property: Property) => {
    setEditingPropertyId(property.id)
    setPropertyForm({
      name: property.name,
      propertyTypeId: property.propertyTypeId || null,
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
    setPropertyForm({
      ...initialPropertyForm,
      propertyTypeId: propertyTypes[0]?.id || null,
    })
    setPropertyError('')
  }

  const handlePropertySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!matchedCity) {
      setPropertyError('Lütfen listeden geçerli bir il seçiniz.')
      return
    }

    const matchedDistrict = availableDistricts.find(
      (d) => d.toLowerCase() === (propertyForm.district || '').toLowerCase()
    )

    if (!matchedDistrict) {
      setPropertyError('Lütfen seçilen ile ait geçerli bir ilçe seçiniz.')
      return
    }

    setIsSubmittingProperty(true)
    setPropertyError('')

    try {
      if (editingPropertyId) {
        const payload: UpdatePropertyPayload = {
          name: propertyForm.name.trim(),
          propertyTypeId: propertyForm.propertyTypeId ? Number(propertyForm.propertyTypeId) : null,
          addressLine: propertyForm.addressLine.trim(),
          city: matchedCity.name,
          district: matchedDistrict,
          description: propertyForm.description ? propertyForm.description.trim() : null,
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
          name: propertyForm.name.trim(),
          propertyTypeId: propertyForm.propertyTypeId ? Number(propertyForm.propertyTypeId) : null,
          addressLine: propertyForm.addressLine.trim(),
          city: matchedCity.name,
          district: matchedDistrict,
          description: propertyForm.description ? propertyForm.description.trim() : null,
        }
        const created = await createProperty(payload)
        setProperties((prev) => [...prev, created])
      }
      setPropertyForm({
        ...initialPropertyForm,
        propertyTypeId: propertyTypes[0]?.id || null,
      })
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
    setUnitForm({
      ...initialUnitForm,
      buildingId: building.id,
      unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
    })
    setEditingUnitId(null)
    setSelectedOccupancyUnit(null)
    setBuildingError('')
    setUnitError('')

    setTimeout(() => {
      unitSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleClearBuildingSelection = () => {
    setSelectedBuilding(null)
    setUnits([])
    setSelectedOccupancyUnit(null)
    setEditingUnitId(null)
    setUnitError('')
  }

  const handleBuildingNameChange = (name: string) => {
    let autoCode = buildingForm.code
    if (!isBlockCodeUserEdited && !editingBuildingId) {
      autoCode = slugifyBlockName(name)
    }
    setBuildingForm((prev) => ({
      ...prev,
      name,
      code: autoCode,
    }))
  }

  const handleBuildingCodeChange = (code: string) => {
    setIsBlockCodeUserEdited(true)
    setBuildingForm((prev) => ({
      ...prev,
      code,
    }))
  }

  const handleEditBuildingClick = (building: Building) => {
    setEditingBuildingId(building.id)
    setIsBlockCodeUserEdited(true)
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
    setIsBlockCodeUserEdited(false)
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
          name: buildingForm.name.trim(),
          code: buildingForm.code.trim(),
          floorCount: Math.floor(Number(buildingForm.floorCount)),
          description: buildingForm.description ? buildingForm.description.trim() : null,
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
          name: buildingForm.name.trim(),
          code: buildingForm.code.trim(),
          floorCount: Math.floor(Number(buildingForm.floorCount)),
          description: buildingForm.description ? buildingForm.description.trim() : null,
        }
        const created = await createBuilding(payload)
        setBuildings((prev) => [...prev, created])
      }
      setIsBlockCodeUserEdited(false)
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
        code: 'MAIN',
        floorCount: Math.floor(Number(singleApartmentFloorCount)),
        description: 'Tek Apartman Binası',
      }

      const created = await createBuilding(payload)
      setBuildings([created])
      setSelectedBuilding(created)
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
        setSelectedOccupancyUnit(null)
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
      unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
    })
    setUnitError('')
  }

  const handleUnitSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedBuilding) return

    const trimmedUnitNumber = unitForm.unitNumber.trim()
    if (!trimmedUnitNumber) {
      setUnitError('Kapı / Bölüm No zorunludur.')
      return
    }

    const normalizedFloorNumber = Math.floor(Number(unitForm.floorNumber))

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
          unitNumber: trimmedUnitNumber,
          floorNumber: normalizedFloorNumber,
          grossArea: unitForm.grossArea ? Number(unitForm.grossArea) : null,
          netArea: unitForm.netArea ? Number(unitForm.netArea) : null,
          description: unitForm.description ? unitForm.description.trim() : null,
          isActive: unitForm.isActive ?? true,
        }
        const updated = await updateUnit(editingUnitId, payload)
        setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
        setSelectedOccupancyUnit((current) =>
          current?.id === updated.id ? updated : current
        )
        setEditingUnitId(null)
      } else {
        const payload: CreateUnitPayload = {
          buildingId: selectedBuilding.id,
          unitTypeId: Number(unitForm.unitTypeId),
          unitNumber: trimmedUnitNumber,
          floorNumber: normalizedFloorNumber,
          grossArea: unitForm.grossArea ? Number(unitForm.grossArea) : null,
          netArea: unitForm.netArea ? Number(unitForm.netArea) : null,
          description: unitForm.description ? unitForm.description.trim() : null,
        }
        const created = await createUnit(payload)
        setUnits((prev) => [...prev, created])
      }
      setUnitForm({
        ...initialUnitForm,
        buildingId: selectedBuilding.id,
        unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
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
      setSelectedOccupancyUnit((current) => (current?.id === id ? null : current))
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'Bağımsız bölüm silinemedi.')
    }
  }

  const handleOpenOccupancyManagement = (unit: Unit) => {
    setSelectedOccupancyUnit(unit)
    setUnitError('')
    window.setTimeout(() => {
      occupancySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  return (
    <main className="page-shell">
      {/* Header Auth Bar */}
      <div className="auth-bar">
        <div className="user-info">
          <span className="user-name">
            {user?.firstName} {user?.lastName} ({user?.userName})
          </span>
          {user?.roles?.map((role) => (
            <span key={role} className={`role-badge ${role.toLowerCase()}`}>
              {role}
            </span>
          ))}
        </div>
        <button className="secondary-button" onClick={() => logout()}>
          Çıkış Yap
        </button>
      </div>

      <header className="page-header">
        <p className="eyebrow">Phase 5 — Residential Management System</p>
        <h1>Site & Gayrimenkul Yönetimi</h1>
        <p className="page-description">
          Gayrimenkul, bina/blok ve bağımsız bölüm hiyerarşisini rolünüze uygun yetkilerle yönetin.
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
            <strong>{selectedBuilding ? selectedBuilding.name : 'Seçilmedi'}</strong>
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
        <div className={`content-grid ${!canCreateProperty && !editingPropertyId ? 'single-column-grid' : ''}`}>
          {/* Property Form - Rendered only for ADMIN and MANAGER */}
          {(canCreateProperty || (editingPropertyId && canEditProperty)) && (
            <section className="panel">
              <div className="section-heading">
                <h2>{editingPropertyId ? 'Gayrimenkulü Düzenle' : 'Yeni Gayrimenkul Ekle'}</h2>
                <p>Sisteme yeni bir site, apartman veya ticari yapı kaydedin.</p>
              </div>

              {propertyError && <p className="status-message error-message">{propertyError}</p>}

              <form className="property-form" onSubmit={handlePropertySubmit}>
                <div className="form-field">
                  <label htmlFor="prop-name">Gayrimenkul Adı *</label>
                  <input
                    id="prop-name"
                    value={propertyForm.name}
                    onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                    placeholder="Örn: Akdeniz Sitesi"
                    required
                  />
                </div>

                <div className="form-field">
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
                        {pt.name}
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
          )}

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
                        <p className="subtitle">
                          {prop.propertyTypeName || PROPERTY_TYPE_LABEL_MAP[prop.propertyType] || prop.propertyType}
                        </p>
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

                      {canEditProperty && (
                        <button
                          className="action-button edit-btn"
                          onClick={() => handleEditPropertyClick(prop)}
                        >
                          Düzenle
                        </button>
                      )}

                      {canDeleteProperty && prop.isActive && (
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
                      Bu apartman pasif durumdadır. Bina yapısını hazırlamak ve bağımsız bölüm eklemek için önce gayrimenkulü aktifleştirin.
                    </p>
                  </div>
                ) : canCreateBuilding ? (
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
                ) : (
                  <div>
                    <div className="section-heading">
                      <h2>Apartman Yapısı Henüz Tanımlanmamış</h2>
                      <p className="status-message empty-state-box">
                        Bu apartmanın kat sayısı henüz yöneticiler tarafından belirlenmemiştir.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div>
                  <div className="section-heading">
                    <h2>Tek Apartman Kaydı Hazır</h2>
                    <p>
                      <strong>{buildings[0].name}</strong> ({formatFloorDisplay(buildings[0].floorCount)}) için bağımsız bölüm yönetimi aktifleştirildi. Aşağıdaki bölümden daire veya dükkan ekleyebilirsiniz.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* RESIDENTIAL COMPLEX / COMMERCIAL / MIXED USE REGULAR FLOW */
            <div className={`content-grid ${!canCreateBuilding && !editingBuildingId ? 'single-column-grid' : ''}`}>
              {/* Building Form - Rendered only for ADMIN and MANAGER */}
              {(canCreateBuilding || (editingBuildingId && canEditBuilding)) && (
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
                        onChange={(e) => handleBuildingNameChange(e.target.value)}
                        placeholder="Örn: A Blok, Güney Rezidans"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="bld-code">Blok Kodu *</label>
                      <input
                        id="bld-code"
                        value={buildingForm.code}
                        onChange={(e) => handleBuildingCodeChange(e.target.value)}
                        placeholder="Örn: A, B, GUN-01"
                        required
                      />
                      <small className="field-help" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                        Site içinde bloğu kısa ve benzersiz biçimde tanımlar. Örn: A, B, GUN-01
                      </small>
                    </div>

                    <div className="form-field">
                      <label htmlFor="bld-floor">Kat Sayısı (1-200) *</label>
                      <input
                        id="bld-floor"
                        type="number"
                        min={1}
                        max={200}
                        value={buildingForm.floorCount}
                        onChange={(e) => setBuildingForm({ ...buildingForm, floorCount: Math.floor(Number(e.target.value)) })}
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
              )}

              {/* Building List */}
              <section className="panel">
                <div className="section-heading">
                  <h2>Bina Listesi</h2>
                  <p>{buildings.length} bina bulundu. Birini seçerek bağımsız bölümlerini yönetin.</p>
                </div>

                {isLoadingBuildings && <p className="status-message">Binalar yükleniyor...</p>}

                {!isLoadingBuildings && buildings.length === 0 && (
                  <p className="status-message empty-state-box">
                    Bu gayrimenkule ait henüz bina/blok bulunmuyor.
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
                            <p className="subtitle">Blok Kodu: {bld.code} | {formatFloorDisplay(bld.floorCount)} (Toplam Kat)</p>
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

                          {canEditBuilding && (
                            <button
                              className="action-button edit-btn"
                              onClick={() => handleEditBuildingClick(bld)}
                            >
                              Düzenle
                            </button>
                          )}

                          {canDeleteBuilding && (
                            <button
                              className="action-button danger-btn"
                              onClick={() => handleDeleteBuildingClick(bld.id)}
                            >
                              Sil
                            </button>
                          )}
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

          <div className={`content-grid ${!canCreateUnit && !editingUnitId ? 'single-column-grid' : ''}`}>
            {/* Unit Form - Rendered only for ADMIN and MANAGER */}
            {(canCreateUnit || (editingUnitId && canEditUnit)) && (
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
                      placeholder="Örn: 1, 12, A1, B-03"
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
                      {selectableUnitTypes.map((ut) => (
                        <option key={ut.id} value={ut.id}>
                          {ut.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="unit-floor">Kat No *</label>
                    <input
                      id="unit-floor"
                      type="number"
                      value={unitForm.floorNumber}
                      onChange={(e) => setUnitForm({ ...unitForm, floorNumber: Math.floor(Number(e.target.value)) })}
                      required
                    />
                    <small className="field-help" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      0: Zemin Kat, Negatif: Bodrum Kat (örn: -1), Pozitif: Normal Kat (örn: 2)
                    </small>
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
            )}

            {/* Unit List */}
            <section className="panel">
              <div className="section-heading">
                <h2>Bölüm Listesi</h2>
                <p>{units.length} bağımsız bölüm bulundu.</p>
              </div>

              {isLoadingUnits && <p className="status-message">Bölümler yükleniyor...</p>}

              {!isLoadingUnits && units.length === 0 && (
                <p className="status-message empty-state-box">
                  Bu bina altında henüz kayıtlı bağımsız bölüm bulunmamaktadır.
                </p>
              )}

              <div className="card-list">
                {units.map((u) => (
                  <article className="item-card" key={u.id}>
                    <div className="card-header">
                      <div>
                        <h3>{formatUnitDisplay(u.unitNumber, u.unitTypeName)}</h3>
                        <p className="subtitle">
                          Tür: <strong>{u.unitTypeName}</strong> | {formatFloorDisplay(u.floorNumber)}
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
                      {canEditUnit && (
                        <button className="action-button edit-btn" onClick={() => handleEditUnitClick(u)}>
                          Düzenle
                        </button>
                      )}

                      {canManageOccupancies && (
                        <button
                          className={`action-button ${
                            selectedOccupancyUnit?.id === u.id ? 'active-select' : 'select-btn'
                          }`}
                          onClick={() => handleOpenOccupancyManagement(u)}
                        >
                          {selectedOccupancyUnit?.id === u.id ? 'Sakinler Açık' : 'Sakinleri Yönet'}
                        </button>
                      )}

                      {canDeleteUnit && (
                        <button className="action-button danger-btn" onClick={() => handleDeleteUnitClick(u.id)}>
                          Sil
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {canManageOccupancies && selectedOccupancyUnit && (
            <div ref={occupancySectionRef} className="occupancy-section-wrapper">
              <OccupancyManagement
                unit={selectedOccupancyUnit}
                onClose={() => setSelectedOccupancyUnit(null)}
              />
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default App
