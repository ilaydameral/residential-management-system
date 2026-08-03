import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type FormEvent,
  type ReactNode,
} from 'react'
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
import DashboardOverview from './components/DashboardOverview'
import { OccupancyManagement } from './components/OccupancyManagement'
import { ResidentUnits } from './components/ResidentUnits'
import { SearchableSelect } from './components/SearchableSelect'
import { useAuth } from './context/AuthContext'
import { TURKEY_CITIES } from './data/turkeyLocations'
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard'
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

const ROLE_LABEL_MAP: Record<string, string> = {
  ADMIN: 'Yönetici',
  MANAGER: 'Site Yöneticisi',
  RESIDENT: 'Sakin',
  TECHNICAL_STAFF: 'Teknik Personel',
}

type ManagementView = 'overview' | 'properties' | 'buildings' | 'units' | 'users' | 'residents'
type NavigationGroup = 'structures' | 'people'

const MANAGEMENT_MENU: Array<{ id: ManagementView; label: string }> = [
  { id: 'overview', label: 'Genel Bakış' },
  { id: 'properties', label: 'Yapılar' },
  { id: 'buildings', label: 'Bloklar' },
  { id: 'units', label: 'Daireler' },
  { id: 'users', label: 'Kullanıcılar' },
  { id: 'residents', label: 'Site Sakinleri' },
]

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

interface OccupancyErrorBoundaryProps {
  children: ReactNode
  onClose: () => void
}

class OccupancyErrorBoundary extends Component<
  OccupancyErrorBoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Sakin yönetimi ekranı oluşturulamadı.', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="panel occupancy-panel">
          <p className="status-message error-message" role="alert">
            Sakin yönetimi ekranı açılırken bir sorun oluştu. Lütfen ekranı kapatıp tekrar deneyin.
          </p>
          <button className="secondary-button" type="button" onClick={this.props.onClose}>
            Ekranı Kapat
          </button>
        </section>
      )
    }

    return this.props.children
  }
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
  const isManagementPanel = hasAnyRole(['ADMIN', 'MANAGER'])
  const isResidentView = hasRole('RESIDENT') &&
    !hasAnyRole(['ADMIN', 'MANAGER', 'TECHNICAL_STAFF'])

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
  const [activeManagementView, setActiveManagementView] = useState<ManagementView>('overview')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [openNavigationGroup, setOpenNavigationGroup] = useState<NavigationGroup | null>(null)

  // Single Apartment Setup State
  const [singleApartmentFloorCount, setSingleApartmentFloorCount] = useState(1)

  // Block Code User Input Override Flag
  const [isBlockCodeUserEdited, setIsBlockCodeUserEdited] = useState(false)

  // Forms
  const [propertyForm, setPropertyForm] = useState(initialPropertyForm)
  const [buildingForm, setBuildingForm] = useState(initialBuildingForm)
  const [unitForm, setUnitForm] = useState(initialUnitForm)
  const [propertyFormDirty, setPropertyFormDirty] = useState(false)
  const [buildingFormDirty, setBuildingFormDirty] = useState(false)
  const [unitFormDirty, setUnitFormDirty] = useState(false)
  const [occupancyFormDirty, setOccupancyFormDirty] = useState(false)

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
  const managementNavigationRef = useRef<HTMLElement | null>(null)
  const structuresTriggerRef = useRef<HTMLButtonElement | null>(null)
  const peopleTriggerRef = useRef<HTMLButtonElement | null>(null)

  const hasUnsavedChanges =
    propertyFormDirty || buildingFormDirty || unitFormDirty || occupancyFormDirty
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(hasUnsavedChanges)

  const resetUiState = useCallback(() => {
    setProperties([])
    setBuildings([])
    setUnits([])
    setPropertyTypes([])
    setUnitTypes([])
    setSelectedProperty(null)
    setSelectedBuilding(null)
    setSelectedOccupancyUnit(null)
    setPropertyForm(initialPropertyForm)
    setBuildingForm(initialBuildingForm)
    setUnitForm(initialUnitForm)
    setEditingPropertyId(null)
    setEditingBuildingId(null)
    setEditingUnitId(null)
    setPropertyError('')
    setBuildingError('')
    setUnitError('')
    setPropertyFormDirty(false)
    setBuildingFormDirty(false)
    setUnitFormDirty(false)
    setOccupancyFormDirty(false)
    setIsBlockCodeUserEdited(false)
    setSingleApartmentFloorCount(1)
    setActiveManagementView('overview')
    setIsSidebarOpen(false)
    setOpenNavigationGroup(null)
  }, [])

  const handleOccupancyDirtyChange = useCallback((isDirty: boolean) => {
    setOccupancyFormDirty(isDirty)
  }, [])

  const handleCloseOccupancyManagement = useCallback(() => {
    setSelectedOccupancyUnit(null)
    setOccupancyFormDirty(false)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      resetUiState()
    }
  }, [isAuthenticated, resetUiState])

  useEffect(() => {
    if (!isManagementPanel) return

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (
        managementNavigationRef.current &&
        !managementNavigationRef.current.contains(event.target as Node)
      ) {
        setOpenNavigationGroup(null)
        setIsSidebarOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      if (openNavigationGroup === 'structures') structuresTriggerRef.current?.focus()
      if (openNavigationGroup === 'people') peopleTriggerRef.current?.focus()
      setOpenNavigationGroup(null)
      setIsSidebarOpen(false)
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isManagementPanel, openNavigationGroup])

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
  const showPropertySection = !isManagementPanel || activeManagementView === 'properties'
  const showBuildingSection = !isManagementPanel || activeManagementView === 'buildings'
  const showUnitSection =
    !isManagementPanel || activeManagementView === 'units' || activeManagementView === 'residents'
  const showUnitManagementActions = !isManagementPanel || activeManagementView === 'units'
  const showOccupancyActions = !isManagementPanel || activeManagementView === 'residents'

  // Load Initial Lookups and Properties when authenticated
  useEffect(() => {
    if (!isAuthenticated || isResidentView) return

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
          setPropertyFormDirty(false)
        }
      } catch (err) {
        setPropertyError(err instanceof Error ? err.message : 'Veriler yüklenirken hata oluştu.')
      } finally {
        setIsLoadingProperties(false)
      }
    }

    loadData()
  }, [isAuthenticated, isResidentView])

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
        setBuildingFormDirty(false)
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
        setUnitFormDirty(false)
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
        setUnitFormDirty(false)
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

  if (isResidentView) {
    return <ResidentUnits />
  }

  // ==========================================
  // PROPERTY HANDLERS
  // ==========================================
  const handleSelectProperty = async (property: Property) => {
    if (!(await requestDiscard())) return

    setSelectedProperty(property)
    setSelectedBuilding(null)
    setUnits([])
    setSelectedOccupancyUnit(null)
    setEditingPropertyId(null)
    setEditingBuildingId(null)
    setEditingUnitId(null)
    setPropertyError('')
    setBuildingError('')
    setUnitError('')
    setPropertyForm({
      ...initialPropertyForm,
      propertyTypeId: propertyTypes[0]?.id || null,
    })
    setBuildingForm({ ...initialBuildingForm, propertyId: property.id })
    setUnitForm(initialUnitForm)
    setPropertyFormDirty(false)
    setBuildingFormDirty(false)
    setUnitFormDirty(false)
    setOccupancyFormDirty(false)

    if (isManagementPanel && activeManagementView === 'properties') {
      setActiveManagementView('buildings')
    }

    setTimeout(() => {
      buildingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleClearPropertySelection = async () => {
    if (!(await requestDiscard())) return

    setSelectedProperty(null)
    setSelectedBuilding(null)
    setBuildings([])
    setUnits([])
    setSelectedOccupancyUnit(null)
    setEditingPropertyId(null)
    setEditingBuildingId(null)
    setEditingUnitId(null)
    setPropertyError('')
    setBuildingError('')
    setUnitError('')
    setPropertyForm({
      ...initialPropertyForm,
      propertyTypeId: propertyTypes[0]?.id || null,
    })
    setBuildingForm(initialBuildingForm)
    setUnitForm(initialUnitForm)
    setPropertyFormDirty(false)
    setBuildingFormDirty(false)
    setUnitFormDirty(false)
    setOccupancyFormDirty(false)
  }

  const handleCityChange = (newCity: string) => {
    setPropertyFormDirty(true)
    setPropertyForm((prev) => ({
      ...prev,
      city: newCity,
      district: '',
    }))
  }

  const handleDistrictChange = (newDistrict: string) => {
    setPropertyFormDirty(true)
    setPropertyForm((prev) => ({
      ...prev,
      district: newDistrict,
    }))
  }

  const handleEditPropertyClick = async (property: Property) => {
    if (!(await requestDiscard(propertyFormDirty))) return

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
    setPropertyFormDirty(false)
  }

  const handleCancelPropertyEdit = async () => {
    if (!(await requestDiscard(propertyFormDirty))) return

    setEditingPropertyId(null)
    setPropertyForm({
      ...initialPropertyForm,
      propertyTypeId: propertyTypes[0]?.id || null,
    })
    setPropertyError('')
    setPropertyFormDirty(false)
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
      setPropertyFormDirty(false)
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
  const handleSelectBuilding = async (building: Building) => {
    if (!(await requestDiscard())) return

    setSelectedBuilding(building)
    setPropertyForm({
      ...initialPropertyForm,
      propertyTypeId: propertyTypes[0]?.id || null,
    })
    setBuildingForm({ ...initialBuildingForm, propertyId: selectedProperty?.id || 0 })
    setUnitForm({
      ...initialUnitForm,
      buildingId: building.id,
      unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
    })
    setEditingUnitId(null)
    setEditingBuildingId(null)
    setSelectedOccupancyUnit(null)
    setBuildingError('')
    setUnitError('')
    setPropertyFormDirty(false)
    setBuildingFormDirty(false)
    setUnitFormDirty(false)
    setOccupancyFormDirty(false)

    if (isManagementPanel && activeManagementView === 'buildings') {
      setActiveManagementView('units')
    }

    setTimeout(() => {
      unitSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleClearBuildingSelection = async () => {
    if (!(await requestDiscard())) return

    setSelectedBuilding(null)
    setUnits([])
    setSelectedOccupancyUnit(null)
    setEditingBuildingId(null)
    setEditingUnitId(null)
    setUnitError('')
    setBuildingForm({ ...initialBuildingForm, propertyId: selectedProperty?.id || 0 })
    setUnitForm(initialUnitForm)
    setBuildingFormDirty(false)
    setUnitFormDirty(false)
    setOccupancyFormDirty(false)
  }

  const handleBuildingNameChange = (name: string) => {
    setBuildingFormDirty(true)
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
    setBuildingFormDirty(true)
    setIsBlockCodeUserEdited(true)
    setBuildingForm((prev) => ({
      ...prev,
      code,
    }))
  }

  const handleEditBuildingClick = async (building: Building) => {
    if (!(await requestDiscard(buildingFormDirty))) return

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
    setBuildingFormDirty(false)
  }

  const handleCancelBuildingEdit = async () => {
    if (!(await requestDiscard(buildingFormDirty))) return

    setEditingBuildingId(null)
    setIsBlockCodeUserEdited(false)
    setBuildingForm({ ...initialBuildingForm, propertyId: selectedProperty?.id || 0 })
    setBuildingError('')
    setBuildingFormDirty(false)
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
      setBuildingFormDirty(false)
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
      setBuildingFormDirty(false)
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
  const handleEditUnitClick = async (unit: Unit) => {
    if (!(await requestDiscard(unitFormDirty))) return

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
    setUnitFormDirty(false)
  }

  const handleCancelUnitEdit = async () => {
    if (!(await requestDiscard(unitFormDirty))) return

    setEditingUnitId(null)
    setUnitForm({
      ...initialUnitForm,
      buildingId: selectedBuilding?.id || 0,
      unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
    })
    setUnitError('')
    setUnitFormDirty(false)
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
        const createdUnitType = unitTypes.find((unitType) => unitType.id === created.unitTypeId)
        const createdForState: Unit = {
          ...created,
          buildingId: created.buildingId || selectedBuilding.id,
          buildingName: created.buildingName?.trim() || selectedBuilding.name,
          propertyId: created.propertyId || selectedProperty?.id || 0,
          propertyName: created.propertyName?.trim() || selectedProperty?.name || '',
          unitTypeId: created.unitTypeId || Number(unitForm.unitTypeId),
          unitTypeName: created.unitTypeName?.trim() || createdUnitType?.name || '',
          unitTypeCode: created.unitTypeCode?.trim() || createdUnitType?.code || '',
        }
        setUnits((prev) => [...prev, createdForState])
      }
      setUnitForm({
        ...initialUnitForm,
        buildingId: selectedBuilding.id,
        unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
      })
      setUnitFormDirty(false)
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

  const handleOpenOccupancyManagement = async (unit: Unit) => {
    if (!(await requestDiscard())) return

    if (!unit || !Number.isInteger(unit.id) || unit.id <= 0) {
      setSelectedOccupancyUnit(null)
      setUnitError('Sakin yönetimi açılamadı. Daire bilgileri eksik veya geçersiz.')
      return
    }

    const safeUnit: Unit = {
      ...unit,
      buildingName: unit.buildingName?.trim() || selectedBuilding?.name || 'Bina bilgisi yok',
      propertyName: unit.propertyName?.trim() || selectedProperty?.name || 'Site/apartman bilgisi yok',
      unitNumber: unit.unitNumber?.trim() || 'Numara belirtilmemiş',
      unitTypeName: unit.unitTypeName?.trim() || 'Bağımsız Bölüm',
    }

    setSelectedOccupancyUnit(safeUnit)
    setUnitError('')
    setEditingPropertyId(null)
    setEditingBuildingId(null)
    setEditingUnitId(null)
    setPropertyForm({
      ...initialPropertyForm,
      propertyTypeId: propertyTypes[0]?.id || null,
    })
    setBuildingForm({ ...initialBuildingForm, propertyId: selectedProperty?.id || 0 })
    setUnitForm({
      ...initialUnitForm,
      buildingId: selectedBuilding?.id || 0,
      unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
    })
    setPropertyFormDirty(false)
    setBuildingFormDirty(false)
    setUnitFormDirty(false)
    setOccupancyFormDirty(false)
    if (isManagementPanel && activeManagementView === 'units') {
      setActiveManagementView('residents')
    }
    window.setTimeout(() => {
      occupancySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleManagementNavigation = async (view: ManagementView) => {
    if (view === activeManagementView) {
      setIsSidebarOpen(false)
      setOpenNavigationGroup(null)
      return
    }
    if (!(await requestDiscard())) return

    setActiveManagementView(view)
    setIsSidebarOpen(false)
    setOpenNavigationGroup(null)
    setSelectedProperty(null)
    setSelectedBuilding(null)
    setSelectedOccupancyUnit(null)
    setBuildings([])
    setUnits([])
    setEditingPropertyId(null)
    setEditingBuildingId(null)
    setEditingUnitId(null)
    setPropertyForm({
      ...initialPropertyForm,
      propertyTypeId: propertyTypes[0]?.id || null,
    })
    setBuildingForm(initialBuildingForm)
    setUnitForm(initialUnitForm)
    setPropertyError('')
    setBuildingError('')
    setUnitError('')
    setPropertyFormDirty(false)
    setBuildingFormDirty(false)
    setUnitFormDirty(false)
    setOccupancyFormDirty(false)
    setIsBlockCodeUserEdited(false)
    setSingleApartmentFloorCount(1)
  }

  const handleNavigationItemClick = (view: ManagementView) => {
    setOpenNavigationGroup(null)
    setIsSidebarOpen(false)
    void handleManagementNavigation(view)
  }

  const handleNavigationGroupToggle = (group: NavigationGroup) => {
    setOpenNavigationGroup((current) => (current === group ? null : group))
  }

  const handleMobileMenuToggle = () => {
    if (isSidebarOpen) setOpenNavigationGroup(null)
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleLogout = async () => {
    if (!(await requestDiscard())) return
    resetUiState()
    logout()
  }

  const activeViewLabel =
    MANAGEMENT_MENU.find((item) => item.id === activeManagementView)?.label || 'Yönetim Paneli'
  const isStructuresView = ['properties', 'buildings', 'units'].includes(activeManagementView)
  const isPeopleView = ['users', 'residents'].includes(activeManagementView)

  return (
    <div className={isManagementPanel ? 'management-layout' : ''}>
      {isManagementPanel && (
        <>
          <header className="management-navigation" ref={managementNavigationRef}>
            <div className="sidebar-brand">
              <span className="sidebar-brand-mark">SY</span>
              <div>
                <strong>Site Yönetimi</strong>
                <small>Yönetim Paneli</small>
              </div>
            </div>

            <button
              className="mobile-menu-button"
              type="button"
              aria-label={isSidebarOpen ? 'Menüyü kapat' : 'Menüyü aç'}
              aria-expanded={isSidebarOpen}
              onClick={handleMobileMenuToggle}
            >
              ☰
            </button>

            <nav className={`management-nav-menu ${isSidebarOpen ? 'open' : ''}`} aria-label="Yönetim menüsü">
              <button
                className={activeManagementView === 'overview' ? 'active' : ''}
                type="button"
                onClick={() => handleNavigationItemClick('overview')}
              >
                Genel Bakış
              </button>

              <div
                className="management-nav-group"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setOpenNavigationGroup(null)
                  }
                }}
              >
                <button
                  ref={structuresTriggerRef}
                  className={`management-nav-trigger ${isStructuresView ? 'active' : ''} ${
                    openNavigationGroup === 'structures' ? 'open' : ''
                  }`}
                  type="button"
                  aria-expanded={openNavigationGroup === 'structures'}
                  aria-controls="structures-navigation-menu"
                  onClick={() => handleNavigationGroupToggle('structures')}
                >
                  Yapı Yönetimi <span aria-hidden="true">⌄</span>
                </button>
                <div
                  id="structures-navigation-menu"
                  className={`management-nav-popup ${openNavigationGroup === 'structures' ? 'open' : ''}`}
                  role="menu"
                  hidden={openNavigationGroup !== 'structures'}
                >
                  {MANAGEMENT_MENU.filter((item) => ['properties', 'buildings', 'units'].includes(item.id)).map((item) => (
                    <button
                      key={item.id}
                      className={activeManagementView === item.id ? 'active' : ''}
                      type="button"
                      role="menuitem"
                      onClick={() => handleNavigationItemClick(item.id)}
                    >
                      <strong>{item.label}</strong>
                      <small>
                        {item.id === 'properties' && 'Site ve apartman kayıtlarını yönetin.'}
                        {item.id === 'buildings' && 'Blok ve bina kayıtlarına ulaşın.'}
                        {item.id === 'units' && 'Daire ve bağımsız bölümleri yönetin.'}
                      </small>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="management-nav-group"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setOpenNavigationGroup(null)
                  }
                }}
              >
                <button
                  ref={peopleTriggerRef}
                  className={`management-nav-trigger ${isPeopleView ? 'active' : ''} ${
                    openNavigationGroup === 'people' ? 'open' : ''
                  }`}
                  type="button"
                  aria-expanded={openNavigationGroup === 'people'}
                  aria-controls="people-navigation-menu"
                  onClick={() => handleNavigationGroupToggle('people')}
                >
                  Kişiler <span aria-hidden="true">⌄</span>
                </button>
                <div
                  id="people-navigation-menu"
                  className={`management-nav-popup compact ${openNavigationGroup === 'people' ? 'open' : ''}`}
                  role="menu"
                  hidden={openNavigationGroup !== 'people'}
                >
                  {MANAGEMENT_MENU.filter((item) => ['users', 'residents'].includes(item.id)).map((item) => (
                    <button
                      key={item.id}
                      className={activeManagementView === item.id ? 'active' : ''}
                      type="button"
                      role="menuitem"
                      onClick={() => handleNavigationItemClick(item.id)}
                    >
                      <strong>{item.label}</strong>
                      <small>
                        {item.id === 'users'
                          ? 'Sistemdeki kullanıcıları bulun.'
                          : 'Daire sakinlerini yönetin.'}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            </nav>

            <div className="management-nav-user">
              <div className="user-info">
                <span className="user-name">
                  {user?.firstName} {user?.lastName}
                </span>
                {user?.roles?.map((role) => (
                  <span key={role} className={`role-badge ${role.toLowerCase()}`}>
                    {ROLE_LABEL_MAP[role] || role}
                  </span>
                ))}
              </div>
              <button className="secondary-button" onClick={handleLogout}>
                Çıkış Yap
              </button>
            </div>
          </header>
          {isSidebarOpen && (
            <button
              className="sidebar-overlay"
              type="button"
              aria-label="Menüyü kapat"
              onClick={() => {
                setIsSidebarOpen(false)
                setOpenNavigationGroup(null)
              }}
            />
          )}
        </>
      )}

      <div className={isManagementPanel ? 'management-workspace' : ''}>
      {!isManagementPanel && <div className="auth-bar">
        <div className="user-info">
          <span className="user-name">
            {user?.firstName} {user?.lastName}
          </span>
          {user?.roles?.map((role) => (
            <span key={role} className={`role-badge ${role.toLowerCase()}`}>
              {ROLE_LABEL_MAP[role] || role}
            </span>
          ))}
        </div>
        <button className="secondary-button" onClick={handleLogout}>
          Çıkış Yap
        </button>
      </div>}

      <main className={isManagementPanel ? 'management-content' : 'page-shell'}>
      <header className="page-header">
        <p className="eyebrow">Yönetim Paneli</p>
        <h1>{isManagementPanel ? activeViewLabel : 'Site & Gayrimenkul Yönetimi'}</h1>
        <p className="page-description">
          {isManagementPanel
            ? 'Site, blok, daire ve sakin işlemlerini ilgili menülerden yönetin.'
            : 'Gayrimenkul, bina/blok ve bağımsız bölüm hiyerarşisini rolünüze uygun yetkilerle yönetin.'}
        </p>

        {/* Selection Breadcrumbs */}
        {!isManagementPanel && <div className="selection-breadcrumbs">
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
        </div>}
      </header>

      {isManagementPanel && activeManagementView === 'overview' && (
        <section className="section-container">
          <DashboardOverview onNavigate={(view) => void handleManagementNavigation(view)} />
        </section>
      )}

      {isManagementPanel && activeManagementView === 'users' && (
        <section className="section-container">
          <section className="panel empty-state-box management-placeholder">
            <h2>Kullanıcılar</h2>
            <p>Kullanıcı yönetimi içeriği sonraki geliştirmelerde bu ekrana eklenecektir.</p>
          </section>
        </section>
      )}

      {isManagementPanel && ['buildings', 'units', 'residents'].includes(activeManagementView) && (
        <section className="section-container management-context-section">
          <section className="panel management-context-panel">
            <div className="section-heading">
              <h2>Çalışma Alanı Seçimi</h2>
              <p>İşlem yapmak istediğiniz yapı ve gerekiyorsa bloğu seçin.</p>
            </div>
            <div className="management-context-fields">
              <div className="form-field">
                <label htmlFor="management-property-select">Yapı</label>
                <select
                  id="management-property-select"
                  value={selectedProperty?.id || ''}
                  onChange={(event) => {
                    const property = properties.find((item) => item.id === Number(event.target.value))
                    if (property) void handleSelectProperty(property)
                    else void handleClearPropertySelection()
                  }}
                >
                  <option value="">Yapı seçin</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
              </div>

              {['units', 'residents'].includes(activeManagementView) && (
                <div className="form-field">
                  <label htmlFor="management-building-select">Blok / Bina</label>
                  <select
                    id="management-building-select"
                    value={selectedBuilding?.id || ''}
                    disabled={!selectedProperty || isLoadingBuildings}
                    onChange={(event) => {
                      const building = buildings.find((item) => item.id === Number(event.target.value))
                      if (building) void handleSelectBuilding(building)
                      else void handleClearBuildingSelection()
                    }}
                  >
                    <option value="">{isLoadingBuildings ? 'Bloklar yükleniyor...' : 'Blok seçin'}</option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.id}>{building.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>
        </section>
      )}

      {/* SECTION 1: PROPERTIES */}
      {showPropertySection && <section className="section-container">
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
                    onChange={(e) => {
                      setPropertyFormDirty(true)
                      setPropertyForm({ ...propertyForm, name: e.target.value })
                    }}
                    placeholder="Örn: Akdeniz Sitesi"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="prop-type">Gayrimenkul Türü *</label>
                  <select
                    id="prop-type"
                    value={propertyForm.propertyTypeId || ''}
                    onChange={(e) => {
                      setPropertyFormDirty(true)
                      setPropertyForm({
                        ...propertyForm,
                        propertyTypeId: e.target.value ? Number(e.target.value) : null,
                      })
                    }}
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
                    onChange={(e) => {
                      setPropertyFormDirty(true)
                      setPropertyForm({ ...propertyForm, addressLine: e.target.value })
                    }}
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
                    onChange={(e) => {
                      setPropertyFormDirty(true)
                      setPropertyForm({ ...propertyForm, description: e.target.value })
                    }}
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
                        onChange={(e) => {
                          setPropertyFormDirty(true)
                          setPropertyForm({ ...propertyForm, isActive: e.target.checked })
                        }}
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
      </section>}

      {/* SECTION 2: BUILDINGS (Requires Selected Property) */}
      {showBuildingSection && selectedProperty && (
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
                          onChange={(e) => {
                            setBuildingFormDirty(true)
                            setSingleApartmentFloorCount(Number(e.target.value))
                          }}
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
                        onChange={(e) => {
                          setBuildingFormDirty(true)
                          setBuildingForm({ ...buildingForm, floorCount: Math.floor(Number(e.target.value)) })
                        }}
                        required
                      />
                    </div>

                    <div className="form-field form-field-full">
                      <label htmlFor="bld-desc">Açıklama</label>
                      <textarea
                        id="bld-desc"
                        value={buildingForm.description || ''}
                        onChange={(e) => {
                          setBuildingFormDirty(true)
                          setBuildingForm({ ...buildingForm, description: e.target.value })
                        }}
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
                            onChange={(e) => {
                              setBuildingFormDirty(true)
                              setBuildingForm({ ...buildingForm, isActive: e.target.checked })
                            }}
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
      {showUnitSection && selectedBuilding && (
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
            {showUnitManagementActions && (canCreateUnit || (editingUnitId && canEditUnit)) && (
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
                      onChange={(e) => {
                        setUnitFormDirty(true)
                        setUnitForm({ ...unitForm, unitNumber: e.target.value })
                      }}
                      placeholder="Örn: 1, 12, A1, B-03"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="unit-type">Bölüm Türü *</label>
                    <select
                      id="unit-type"
                      value={unitForm.unitTypeId || ''}
                      onChange={(e) => {
                        setUnitFormDirty(true)
                        setUnitForm({ ...unitForm, unitTypeId: Number(e.target.value) })
                      }}
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
                      onChange={(e) => {
                        setUnitFormDirty(true)
                        setUnitForm({ ...unitForm, floorNumber: Math.floor(Number(e.target.value)) })
                      }}
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
                      onChange={(e) => {
                        setUnitFormDirty(true)
                        setUnitForm({
                          ...unitForm,
                          grossArea: e.target.value ? Number(e.target.value) : null,
                        })
                      }}
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
                      onChange={(e) => {
                        setUnitFormDirty(true)
                        setUnitForm({
                          ...unitForm,
                          netArea: e.target.value ? Number(e.target.value) : null,
                        })
                      }}
                      placeholder="Örn: 85.50"
                    />
                  </div>

                  <div className="form-field form-field-full">
                    <label htmlFor="unit-desc">Açıklama</label>
                    <textarea
                      id="unit-desc"
                      value={unitForm.description || ''}
                      onChange={(e) => {
                        setUnitFormDirty(true)
                        setUnitForm({ ...unitForm, description: e.target.value })
                      }}
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
                          onChange={(e) => {
                            setUnitFormDirty(true)
                            setUnitForm({ ...unitForm, isActive: e.target.checked })
                          }}
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
                      {showUnitManagementActions && canEditUnit && (
                        <button className="action-button edit-btn" onClick={() => handleEditUnitClick(u)}>
                          Düzenle
                        </button>
                      )}

                      {showOccupancyActions && canManageOccupancies && (
                        <button
                          className={`action-button ${
                            selectedOccupancyUnit?.id === u.id ? 'active-select' : 'select-btn'
                          }`}
                          onClick={() => handleOpenOccupancyManagement(u)}
                        >
                          {selectedOccupancyUnit?.id === u.id ? 'Sakinler Açık' : 'Sakinleri Yönet'}
                        </button>
                      )}

                      {showUnitManagementActions && canDeleteUnit && (
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

          {showOccupancyActions && canManageOccupancies && selectedOccupancyUnit && (
            <div ref={occupancySectionRef} className="occupancy-section-wrapper">
              <OccupancyErrorBoundary
                key={selectedOccupancyUnit.id}
                onClose={handleCloseOccupancyManagement}
              >
                <OccupancyManagement
                  unit={selectedOccupancyUnit}
                  onClose={handleCloseOccupancyManagement}
                  onDirtyChange={handleOccupancyDirtyChange}
                />
              </OccupancyErrorBoundary>
            </div>
          )}
        </section>
      )}
      {unsavedChangesDialog}
      </main>
      </div>
    </div>
  )
}

export default App
