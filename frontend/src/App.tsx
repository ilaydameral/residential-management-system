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
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import {
  createBuilding,
  createProperty,
  createUnit,
  deactivateProperty,
  deleteBuilding,
  deleteUnit,
  getBuildings,
  getBuildingsByProperty,
  getProperties,
  getPropertyTypes,
  getUnits,
  getUnitsByBuilding,
  getUnitTypes,
  updateBuilding,
  updateProperty,
  updateUnit,
} from './api'

import { Login } from './components/Login'
import DashboardOverview from './components/DashboardOverview'
import { CentralOccupancyManagement } from './components/CentralOccupancyManagement'
import { CentralUserManagement } from './components/CentralUserManagement'
import { OccupancyManagement } from './components/OccupancyManagement'
import { ResidentUnits } from './components/ResidentUnits'
import { RowActionsMenu } from './components/RowActionsMenu'
import { SearchableSelect } from './components/SearchableSelect'
import { ThemeToggle } from './components/ThemeToggle'
import { useAuth } from './context/AuthContext'
import { TURKEY_CITIES } from './data/turkeyLocations'
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard'
import { useRouteChangeGuard } from './hooks/useRouteChangeGuard'
import { formatUnitDisplay, formatUnitNumber } from './utils/unitDisplay'
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

const PROPERTY_TYPE_LABEL_MAP: Record<string, string> = {
  SINGLE_APARTMENT: 'Tek Apartman',
  RESIDENTIAL_COMPLEX: 'Rezidans / Konut Sitesi',
  COMMERCIAL: 'Ticari Yapı',
  MIXED_USE: 'Karma Kullanım',
}

function formatPropertyTypeLabel(property: Property): string {
  const storedValue = property.propertyTypeName || property.propertyType
  return (
    PROPERTY_TYPE_LABEL_MAP[property.propertyType] ||
    PROPERTY_TYPE_LABEL_MAP[storedValue] ||
    storedValue ||
    'Belirtilmemiş'
  )
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

const MANAGEMENT_VIEW_PATHS: Record<ManagementView, string> = {
  overview: '/dashboard',
  properties: '/properties',
  buildings: '/buildings',
  units: '/units',
  users: '/users',
  residents: '/residents',
}

function getManagementView(pathname: string): ManagementView {
  if (matchPath('/units/:unitId', pathname)) return 'units'

  const matchedView = (Object.entries(MANAGEMENT_VIEW_PATHS) as Array<[ManagementView, string]>)
    .find(([, path]) => path === pathname)

  return matchedView?.[0] ?? 'overview'
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
  const location = useLocation()
  const navigate = useNavigate()
  const activeManagementView = getManagementView(location.pathname)
  const unitDetailMatch = matchPath('/units/:unitId', location.pathname)
  const routeUnitId = unitDetailMatch?.params.unitId
    ? Number(unitDetailMatch.params.unitId)
    : null

  // Role permissions
  const canCreateProperty = hasAnyRole(['ADMIN', 'MANAGER'])
  const canEditProperty = hasAnyRole(['ADMIN', 'MANAGER'])
  const canDeleteProperty = hasRole('ADMIN')
  const canDeactivateProperty = hasAnyRole(['ADMIN', 'MANAGER'])

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
  const [allBuildings, setAllBuildings] = useState<Building[]>([])
  const [allUnits, setAllUnits] = useState<Unit[]>([])

  // Selections
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [selectedOccupancyUnit, setSelectedOccupancyUnit] = useState<Unit | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [openNavigationGroup, setOpenNavigationGroup] = useState<NavigationGroup | null>(null)
  const [isPropertyDrawerOpen, setIsPropertyDrawerOpen] = useState(false)
  const [isBuildingDrawerOpen, setIsBuildingDrawerOpen] = useState(false)
  const [isUnitDrawerOpen, setIsUnitDrawerOpen] = useState(false)
  const [selectedUnitDetail, setSelectedUnitDetail] = useState<Unit | null>(null)
  const [unitDetailTab, setUnitDetailTab] = useState<'general' | 'residents'>('general')

  const [propertySearch, setPropertySearch] = useState('')
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all')
  const [propertyStatusFilter, setPropertyStatusFilter] = useState('all')
  const [buildingSearch, setBuildingSearch] = useState('')
  const [buildingPropertyFilter, setBuildingPropertyFilter] = useState('all')
  const [buildingStatusFilter, setBuildingStatusFilter] = useState('all')
  const [unitSearch, setUnitSearch] = useState('')
  const [unitPropertyFilter, setUnitPropertyFilter] = useState('all')
  const [unitBuildingFilter, setUnitBuildingFilter] = useState('all')
  const [unitFloorFilter, setUnitFloorFilter] = useState('all')
  const [unitOccupancyFilter, setUnitOccupancyFilter] = useState('all')
  const [unitStatusFilter, setUnitStatusFilter] = useState('all')
  const [unitFormPropertyId, setUnitFormPropertyId] = useState(0)
  const residentInitialSearch = new URLSearchParams(location.search).get('search') || ''

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
  const [isLoadingAllBuildings, setIsLoadingAllBuildings] = useState(false)
  const [isLoadingAllUnits, setIsLoadingAllUnits] = useState(false)
  const [hasLoadedAllUnits, setHasLoadedAllUnits] = useState(false)

  const [isSubmittingProperty, setIsSubmittingProperty] = useState(false)
  const [isSubmittingBuilding, setIsSubmittingBuilding] = useState(false)
  const [isSubmittingUnit, setIsSubmittingUnit] = useState(false)

  const [propertyError, setPropertyError] = useState('')
  const [buildingError, setBuildingError] = useState('')
  const [unitError, setUnitError] = useState('')
  const [propertyListError, setPropertyListError] = useState('')
  const [buildingListError, setBuildingListError] = useState('')
  const [unitListError, setUnitListError] = useState('')

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
    setAllBuildings([])
    setAllUnits([])
    setHasLoadedAllUnits(false)
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
    setIsSidebarOpen(false)
    setOpenNavigationGroup(null)
    setIsPropertyDrawerOpen(false)
    setIsBuildingDrawerOpen(false)
    setIsUnitDrawerOpen(false)
    setSelectedUnitDetail(null)
    setUnitDetailTab('general')
    setPropertySearch('')
    setPropertyTypeFilter('all')
    setPropertyStatusFilter('all')
    setBuildingSearch('')
    setBuildingPropertyFilter('all')
    setBuildingStatusFilter('all')
    setUnitSearch('')
    setUnitPropertyFilter('all')
    setUnitBuildingFilter('all')
    setUnitFloorFilter('all')
    setUnitOccupancyFilter('all')
    setUnitStatusFilter('all')
    setUnitFormPropertyId(0)
    setPropertyListError('')
    setBuildingListError('')
    setUnitListError('')
  }, [])

  const clearRouteTransitionState = useCallback(() => {
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
    setIsPropertyDrawerOpen(false)
    setIsBuildingDrawerOpen(false)
    setIsUnitDrawerOpen(false)
    setSelectedUnitDetail(null)
    setUnitDetailTab('general')
    setPropertySearch('')
    setPropertyTypeFilter('all')
    setPropertyStatusFilter('all')
    setBuildingSearch('')
    setBuildingPropertyFilter('all')
    setBuildingStatusFilter('all')
    setUnitSearch('')
    setUnitPropertyFilter('all')
    setUnitBuildingFilter('all')
    setUnitFloorFilter('all')
    setUnitOccupancyFilter('all')
    setUnitStatusFilter('all')
    setUnitFormPropertyId(0)
    setPropertyListError('')
    setBuildingListError('')
    setUnitListError('')
  }, [propertyTypes])

  const { navigateWithGuard } = useRouteChangeGuard({
    isDirty: hasUnsavedChanges,
    requestDiscard,
    onApprovedRouteChange: clearRouteTransitionState,
  })

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
    if (loading) return

    if (!isAuthenticated) {
      if (location.pathname !== '/login') navigate('/login', { replace: true })
      return
    }

    const isKnownManagementRoute =
      Object.values(MANAGEMENT_VIEW_PATHS).includes(location.pathname) ||
      Boolean(matchPath('/units/:unitId', location.pathname))

    if (isManagementPanel) {
      if (!isKnownManagementRoute) navigate('/dashboard', { replace: true })
      return
    }

    if (isResidentView) {
      if (location.pathname !== '/resident/my-units') {
        navigate('/resident/my-units', { replace: true })
      }
      return
    }

    if (location.pathname !== '/') navigate('/', { replace: true })
  }, [
    isAuthenticated,
    isManagementPanel,
    isResidentView,
    loading,
    location.pathname,
    navigate,
  ])

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
  const showUnitSection = !isManagementPanel || activeManagementView === 'units'
  const showUnitManagementActions = !isManagementPanel || activeManagementView === 'units'
  const showOccupancyActions = !isManagementPanel
  const filteredProperties = properties.filter((property) => {
    const matchesSearch = property.name.toLocaleLowerCase('tr-TR').includes(
      propertySearch.trim().toLocaleLowerCase('tr-TR')
    )
    const matchesType =
      propertyTypeFilter === 'all' || String(property.propertyTypeId) === propertyTypeFilter
    const matchesStatus =
      propertyStatusFilter === 'all' ||
      (propertyStatusFilter === 'active' ? property.isActive : !property.isActive)
    return matchesSearch && matchesType && matchesStatus
  })
  const filteredBuildings = allBuildings.filter((building) => {
    const normalizedSearch = buildingSearch.trim().toLocaleLowerCase('tr-TR')
    const matchesSearch =
      building.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch) ||
      building.code.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
    const matchesProperty =
      buildingPropertyFilter === 'all' || String(building.propertyId) === buildingPropertyFilter
    const matchesStatus =
      buildingStatusFilter === 'all' ||
      (buildingStatusFilter === 'active' ? building.isActive : !building.isActive)
    return matchesSearch && matchesProperty && matchesStatus
  })
  const unitFilterBuildings = allBuildings.filter(
    (building) => unitPropertyFilter === 'all' || String(building.propertyId) === unitPropertyFilter
  )
  const unitFormBuildings = allBuildings.filter(
    (building) => building.propertyId === unitFormPropertyId && (building.isActive || building.id === unitForm.buildingId)
  )
  const unitFloorOptions = Array.from(new Set(allUnits.map((unit) => unit.floorNumber))).sort(
    (left, right) => left - right
  )
  const filteredUnits = allUnits.filter((unit) => {
    const matchesSearch = unit.unitNumber.toLocaleLowerCase('tr-TR').includes(
      unitSearch.trim().toLocaleLowerCase('tr-TR')
    )
    const matchesProperty =
      unitPropertyFilter === 'all' || String(unit.propertyId) === unitPropertyFilter
    const matchesBuilding =
      unitBuildingFilter === 'all' || String(unit.buildingId) === unitBuildingFilter
    const matchesFloor = unitFloorFilter === 'all' || String(unit.floorNumber) === unitFloorFilter
    const matchesOccupancy =
      unitOccupancyFilter === 'all' ||
      (unitOccupancyFilter === 'occupied'
        ? unit.activeOccupancyCount > 0
        : unit.activeOccupancyCount === 0)
    const matchesStatus =
      unitStatusFilter === 'all' ||
      (unitStatusFilter === 'active' ? unit.isActive : !unit.isActive)
    return matchesSearch && matchesProperty && matchesBuilding && matchesFloor && matchesOccupancy && matchesStatus
  })
  const propertyFilterCount = [
    propertySearch.trim() !== '',
    propertyTypeFilter !== 'all',
    propertyStatusFilter !== 'all',
  ].filter(Boolean).length
  const buildingFilterCount = [
    buildingSearch.trim() !== '',
    buildingPropertyFilter !== 'all',
    buildingStatusFilter !== 'all',
  ].filter(Boolean).length
  const unitFilterCount = [
    unitSearch.trim() !== '',
    unitPropertyFilter !== 'all',
    unitBuildingFilter !== 'all',
    unitFloorFilter !== 'all',
    unitOccupancyFilter !== 'all',
    unitStatusFilter !== 'all',
  ].filter(Boolean).length
  const isLoadingCentralUnits = isLoadingAllUnits || isLoadingAllBuildings
  const centralUnitError = unitListError || buildingListError
  const selectedBuildingFormProperty = properties.find(
    (property) => property.id === Number(buildingForm.propertyId)
  )
  const isBuildingFormSingleApartment =
    selectedBuildingFormProperty?.propertyType === 'SINGLE_APARTMENT' ||
    propertyTypes.find((type) => type.id === selectedBuildingFormProperty?.propertyTypeId)?.code ===
      'SINGLE_APARTMENT'

  const loadPropertyList = useCallback(async () => {
    setIsLoadingProperties(true)
    setPropertyListError('')
    try {
      setProperties(await getProperties(true))
    } catch (error) {
      setPropertyListError(error instanceof Error ? error.message : 'Yapılar yüklenemedi.')
    } finally {
      setIsLoadingProperties(false)
    }
  }, [])

  const loadAllBuildingList = useCallback(async () => {
    setIsLoadingAllBuildings(true)
    setBuildingListError('')
    try {
      setAllBuildings(await getBuildings(true))
    } catch (error) {
      setBuildingListError(error instanceof Error ? error.message : 'Bloklar yüklenemedi.')
    } finally {
      setIsLoadingAllBuildings(false)
    }
  }, [])

  const loadAllUnitList = useCallback(async () => {
    setIsLoadingAllUnits(true)
    setUnitListError('')
    try {
      const data = await getUnits(true)
      setAllUnits(data)
      return data
    } catch (error) {
      setUnitListError(error instanceof Error ? error.message : 'Daireler yüklenemedi.')
      return null
    } finally {
      setIsLoadingAllUnits(false)
      setHasLoadedAllUnits(true)
    }
  }, [])

  // Load Initial Lookups and Properties when authenticated
  useEffect(() => {
    if (!isAuthenticated || isResidentView) return

    const loadData = async () => {
      try {
        const [propTypesData, unitTypesData] = await Promise.all([
          getPropertyTypes(false),
          getUnitTypes(false),
        ])
        setPropertyTypes(propTypesData)
        setUnitTypes(unitTypesData)

        if (propTypesData.length > 0) {
          setPropertyForm((prev) => ({ ...prev, propertyTypeId: propTypesData[0].id }))
          setPropertyFormDirty(false)
        }
      } catch (err) {
        setPropertyError(err instanceof Error ? err.message : 'Veriler yüklenirken hata oluştu.')
      }
    }

    void loadPropertyList()
    void loadData()
  }, [isAuthenticated, isResidentView, loadPropertyList])

  useEffect(() => {
    if (!isManagementPanel || !['buildings', 'units', 'residents'].includes(activeManagementView)) return
    void loadAllBuildingList()
  }, [activeManagementView, isManagementPanel, loadAllBuildingList])

  useEffect(() => {
    if (!isManagementPanel || !['units', 'residents'].includes(activeManagementView)) return
    void loadAllUnitList()
  }, [activeManagementView, isManagementPanel, loadAllUnitList])

  useEffect(() => {
    if (routeUnitId == null) {
      setSelectedUnitDetail(null)
      return
    }

    const matchedUnit = allUnits.find((unit) => unit.id === routeUnitId) || null
    setSelectedUnitDetail(matchedUnit)
  }, [allUnits, routeUnitId])

  useEffect(() => {
    const routeSearch = new URLSearchParams(location.search)

    if (activeManagementView === 'buildings') {
      setBuildingPropertyFilter(routeSearch.get('propertyId') || 'all')
    }

    if (activeManagementView === 'units' && routeUnitId == null) {
      setUnitPropertyFilter(routeSearch.get('propertyId') || 'all')
      setUnitBuildingFilter(routeSearch.get('buildingId') || 'all')
    }
  }, [activeManagementView, location.search, routeUnitId])

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
    if (isManagementPanel && activeManagementView === 'properties') {
      await navigateWithGuard(`/buildings?propertyId=${property.id}`)
      return
    }

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

  const handleOpenNewProperty = async () => {
    if (!(await requestDiscard(propertyFormDirty))) return

    setEditingPropertyId(null)
    setPropertyForm({
      ...initialPropertyForm,
      propertyTypeId: propertyTypes[0]?.id || null,
    })
    setPropertyError('')
    setPropertyFormDirty(false)
    setIsPropertyDrawerOpen(true)
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
    setIsPropertyDrawerOpen(true)
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
    setIsPropertyDrawerOpen(false)
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
        await createProperty(payload)
      }
      setPropertyForm({
        ...initialPropertyForm,
        propertyTypeId: propertyTypes[0]?.id || null,
      })
      setPropertyFormDirty(false)
      setIsPropertyDrawerOpen(false)
      await loadPropertyList()
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : 'Yapı kaydedilemedi.')
    } finally {
      setIsSubmittingProperty(false)
    }
  }

  const handleDeactivateProperty = async (id: number) => {
    if (!window.confirm('Bu yapıyı pasifleştirmek istediğinizden emin misiniz?')) {
      return
    }
    try {
      await deactivateProperty(id)
      await loadPropertyList()
      if (selectedProperty?.id === id) {
        const updatedList = await getProperties(true)
        const updatedProp = updatedList.find((p) => p.id === id)
        if (updatedProp) setSelectedProperty(updatedProp)
      }
    } catch (err) {
      setPropertyListError(err instanceof Error ? err.message : 'Yapı pasifleştirilemedi.')
    }
  }

  // ==========================================
  // BUILDING HANDLERS
  // ==========================================
  const handleSelectBuilding = async (building: Building) => {
    if (isManagementPanel && activeManagementView === 'buildings') {
      await navigateWithGuard(
        `/units?propertyId=${building.propertyId}&buildingId=${building.id}`
      )
      return
    }

    if (!(await requestDiscard())) return

    const parentProperty = properties.find((property) => property.id === building.propertyId) || null
    setSelectedProperty(parentProperty)
    setSelectedBuilding(building)
    setPropertyForm({
      ...initialPropertyForm,
      propertyTypeId: propertyTypes[0]?.id || null,
    })
    setBuildingForm({ ...initialBuildingForm, propertyId: building.propertyId })
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

  const handleOpenNewBuilding = async () => {
    if (!(await requestDiscard(buildingFormDirty))) return

    const defaultProperty = properties.find((property) => property.isActive)
    setEditingBuildingId(null)
    setIsBlockCodeUserEdited(false)
    setBuildingForm({ ...initialBuildingForm, propertyId: defaultProperty?.id || 0 })
    setBuildingError('')
    setBuildingFormDirty(false)
    setIsBuildingDrawerOpen(true)
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
    setIsBuildingDrawerOpen(true)
  }

  const handleCancelBuildingEdit = async () => {
    if (!(await requestDiscard(buildingFormDirty))) return

    setEditingBuildingId(null)
    setIsBlockCodeUserEdited(false)
    setBuildingForm({ ...initialBuildingForm, propertyId: selectedProperty?.id || 0 })
    setBuildingError('')
    setBuildingFormDirty(false)
    setIsBuildingDrawerOpen(false)
  }

  const handleBuildingSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const targetProperty = properties.find(
      (property) => property.id === Number(buildingForm.propertyId)
    )
    if (!targetProperty) {
      setBuildingError('Lütfen bağlı yapıyı seçin.')
      return
    }

    setIsSubmittingBuilding(true)
    setBuildingError('')

    try {
      if (editingBuildingId) {
        const payload: UpdateBuildingPayload = {
          propertyId: targetProperty.id,
          name: buildingForm.name.trim(),
          code: buildingForm.code.trim(),
          floorCount: Math.floor(Number(buildingForm.floorCount)),
          description: buildingForm.description ? buildingForm.description.trim() : null,
          isActive: buildingForm.isActive ?? true,
        }
        const updated = await updateBuilding(editingBuildingId, payload)
        if (selectedBuilding?.id === updated.id) {
          setSelectedBuilding(updated)
        }
        setEditingBuildingId(null)
      } else {
        const payload: CreateBuildingPayload = {
          propertyId: targetProperty.id,
          name: isBuildingFormSingleApartment
            ? targetProperty.name
            : buildingForm.name.trim(),
          code: isBuildingFormSingleApartment ? 'MAIN' : buildingForm.code.trim(),
          floorCount: Math.floor(Number(buildingForm.floorCount)),
          description: buildingForm.description ? buildingForm.description.trim() : null,
        }
        await createBuilding(payload)
      }
      setIsBlockCodeUserEdited(false)
      setBuildingForm(initialBuildingForm)
      setBuildingFormDirty(false)
      setIsBuildingDrawerOpen(false)
      await Promise.all([loadAllBuildingList(), loadPropertyList()])
    } catch (err) {
      setBuildingError(err instanceof Error ? err.message : 'Blok kaydedilemedi.')
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
      await Promise.all([loadAllBuildingList(), loadPropertyList()])
      if (selectedBuilding?.id === id) {
        setSelectedBuilding(null)
        setUnits([])
        setSelectedOccupancyUnit(null)
      }
    } catch (err) {
      setBuildingListError(err instanceof Error ? err.message : 'Blok silinemedi.')
    }
  }

  // ==========================================
  // UNIT HANDLERS
  // ==========================================
  const handleOpenNewUnit = async () => {
    if (!(await requestDiscard(unitFormDirty))) return

    const defaultProperty = properties.find((property) => property.isActive)
    const defaultBuilding = allBuildings.find(
      (building) => building.isActive && building.propertyId === defaultProperty?.id
    )
    setEditingUnitId(null)
    setUnitFormPropertyId(defaultProperty?.id || 0)
    setUnitForm({
      ...initialUnitForm,
      buildingId: defaultBuilding?.id || 0,
      unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
    })
    setUnitError('')
    setUnitFormDirty(false)
    setIsUnitDrawerOpen(true)
  }

  const handleEditUnitClick = async (unit: Unit) => {
    if (!(await requestDiscard(unitFormDirty))) return

    setEditingUnitId(unit.id)
    setUnitFormPropertyId(unit.propertyId)
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
    setIsUnitDrawerOpen(true)
  }

  const handleCancelUnitEdit = async () => {
    if (!(await requestDiscard(unitFormDirty))) return

    setEditingUnitId(null)
    setUnitForm({
      ...initialUnitForm,
      buildingId: 0,
      unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
    })
    setUnitFormPropertyId(0)
    setUnitError('')
    setUnitFormDirty(false)
    setIsUnitDrawerOpen(false)
  }

  const handleUnitSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const targetBuilding = allBuildings.find(
      (building) => building.id === Number(unitForm.buildingId)
    )
    if (!targetBuilding) {
      setUnitError('Lütfen bağlı blok veya binayı seçin.')
      return
    }

    const trimmedUnitNumber = formatUnitNumber(unitForm.unitNumber)
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
          buildingId: targetBuilding.id,
          unitTypeId: Number(unitForm.unitTypeId),
          unitNumber: trimmedUnitNumber,
          floorNumber: normalizedFloorNumber,
          grossArea: unitForm.grossArea ? Number(unitForm.grossArea) : null,
          netArea: unitForm.netArea ? Number(unitForm.netArea) : null,
          description: unitForm.description ? unitForm.description.trim() : null,
          isActive: unitForm.isActive ?? true,
        }
        await updateUnit(editingUnitId, payload)
        setEditingUnitId(null)
      } else {
        const payload: CreateUnitPayload = {
          buildingId: targetBuilding.id,
          unitTypeId: Number(unitForm.unitTypeId),
          unitNumber: trimmedUnitNumber,
          floorNumber: normalizedFloorNumber,
          grossArea: unitForm.grossArea ? Number(unitForm.grossArea) : null,
          netArea: unitForm.netArea ? Number(unitForm.netArea) : null,
          description: unitForm.description ? unitForm.description.trim() : null,
        }
        await createUnit(payload)
      }
      setUnitForm({
        ...initialUnitForm,
        buildingId: 0,
        unitTypeId: selectableUnitTypes[0]?.id || unitTypes[0]?.id || 0,
      })
      setUnitFormPropertyId(0)
      setUnitFormDirty(false)
      setIsUnitDrawerOpen(false)
      const [refreshedUnits] = await Promise.all([
        loadAllUnitList(),
        loadAllBuildingList(),
        loadPropertyList(),
      ])
      if (selectedUnitDetail && refreshedUnits) {
        setSelectedUnitDetail(
          refreshedUnits.find((unit) => unit.id === selectedUnitDetail.id) || null
        )
      }
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'Daire kaydedilemedi.')
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
      await Promise.all([loadAllUnitList(), loadAllBuildingList(), loadPropertyList()])
      setSelectedOccupancyUnit((current) => (current?.id === id ? null : current))
      setSelectedUnitDetail((current) => (current?.id === id ? null : current))
    } catch (err) {
      setUnitListError(err instanceof Error ? err.message : 'Daire silinemedi.')
    }
  }

  const handleOpenUnitDetail = async (unit: Unit, tab: 'general' | 'residents' = 'general') => {
    if (!(await navigateWithGuard(`/units/${unit.id}`))) return
    setSelectedUnitDetail(unit)
    setUnitDetailTab(tab)
    setOccupancyFormDirty(false)
  }

  const handleOpenUnitDetailFromResidents = async (unitId: number) => {
    const unit = allUnits.find((item) => item.id === unitId)
    if (!unit) {
      setUnitListError('Daire detayı açılamadı. Listeyi yenileyip tekrar deneyin.')
      return
    }
    if (!(await navigateWithGuard(`/units/${unitId}`))) return
    setSelectedUnitDetail(unit)
    setUnitDetailTab('general')
    setOccupancyFormDirty(false)
    setOpenNavigationGroup(null)
    setIsSidebarOpen(false)
  }

  const handleCloseUnitDetail = async () => {
    if (!(await navigateWithGuard('/units'))) return
    void loadAllUnitList()
  }

  const handleUnitDetailTabChange = async (tab: 'general' | 'residents') => {
    if (tab === unitDetailTab) return
    if (!(await requestDiscard(occupancyFormDirty))) return
    setOccupancyFormDirty(false)
    setUnitDetailTab(tab)
  }

  const handleOpenOccupancyManagement = async (unit: Unit) => {
    if (isManagementPanel) {
      if (!(await navigateWithGuard('/residents'))) return
    } else if (!(await requestDiscard())) {
      return
    }

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
    window.setTimeout(() => {
      occupancySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleManagementNavigation = async (view: ManagementView) => {
    await navigateWithGuard(MANAGEMENT_VIEW_PATHS[view])
  }

  const handleViewUserUnits = async (email: string) => {
    await navigateWithGuard(`/residents?search=${encodeURIComponent(email)}`)
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
    navigate('/login', { replace: true })
  }

  const activeViewLabel =
    MANAGEMENT_MENU.find((item) => item.id === activeManagementView)?.label || 'Yönetim Paneli'
  const activeViewDescription =
    activeManagementView === 'properties'
      ? 'Site, apartman ve diğer yapı kayıtlarını tek merkezden yönetin.'
      : activeManagementView === 'buildings'
        ? 'Tüm yapılara bağlı blokları tek merkezden yönetin.'
        : activeManagementView === 'units'
          ? 'Tüm daire ve bağımsız bölümleri tek merkezden yönetin.'
          : activeManagementView === 'users'
            ? 'Sistem kullanıcılarını, hesap durumlarını ve rollerini tek merkezden yönetin.'
          : activeManagementView === 'residents'
            ? 'Aktif ve geçmiş sakin ilişkilerini tek merkezden yönetin.'
            : 'Site, blok, daire ve sakin işlemlerini ilgili menülerden yönetin.'
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
              <ThemeToggle />
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
        <ThemeToggle />
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
            ? activeViewDescription
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
        <section className="section-container entity-management-view">
          <CentralUserManagement
            onDirtyChange={handleOccupancyDirtyChange}
            onViewUnits={(email) => { void handleViewUserUnits(email) }}
          />
        </section>
      )}

      {isManagementPanel && activeManagementView === 'residents' && (
        <section className="section-container entity-management-view">
          <CentralOccupancyManagement
            properties={properties}
            buildings={allBuildings}
            units={allUnits}
            isReferenceDataLoading={isLoadingAllBuildings || isLoadingAllUnits}
            referenceDataError={buildingListError || unitListError}
            onRetryReferenceData={() => { void Promise.all([loadAllBuildingList(), loadAllUnitList(), loadPropertyList()]) }}
            onOpenUnitDetail={(unitId) => { void handleOpenUnitDetailFromResidents(unitId) }}
            onDirtyChange={handleOccupancyDirtyChange}
            initialSearch={residentInitialSearch}
          />
        </section>
      )}

      {isManagementPanel && activeManagementView === 'properties' && (
        <section className="section-container entity-management-view">
          <div className="entity-page-actions">
            <p>{filteredProperties.length} yapı gösteriliyor.</p>
            {canCreateProperty && (
              <button className="primary-button" type="button" onClick={() => void handleOpenNewProperty()}>
                Yeni Yapı
              </button>
            )}
          </div>

          <section className="panel entity-toolbar" aria-label="Yapı filtreleri">
            <div className="form-field">
              <label htmlFor="property-search">Yapı Ara</label>
              <input
                id="property-search"
                value={propertySearch}
                onChange={(event) => setPropertySearch(event.target.value)}
                placeholder="Yapı adına göre ara"
              />
            </div>
            <div className="form-field">
              <label htmlFor="property-type-filter">Yapı Türü</label>
              <select
                id="property-type-filter"
                value={propertyTypeFilter}
                onChange={(event) => setPropertyTypeFilter(event.target.value)}
              >
                <option value="all">Tüm türler</option>
                {propertyTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="property-status-filter">Durum</label>
              <select
                id="property-status-filter"
                value={propertyStatusFilter}
                onChange={(event) => setPropertyStatusFilter(event.target.value)}
              >
                <option value="all">Tüm durumlar</option>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
            <button
              className={`secondary-button entity-filter-clear ${propertyFilterCount > 0 ? 'has-active-filters' : ''}`}
              type="button"
              disabled={propertyFilterCount === 0}
              onClick={() => {
                setPropertySearch('')
                setPropertyTypeFilter('all')
                setPropertyStatusFilter('all')
              }}
            >
              <span>Filtreleri Temizle</span>
              {propertyFilterCount > 0 && <span className="filter-count-badge" aria-label={`${propertyFilterCount} aktif filtre`}>{propertyFilterCount}</span>}
            </button>
          </section>

          {isLoadingProperties && (
            <section className="panel entity-state-panel">Yapılar yükleniyor...</section>
          )}

          {!isLoadingProperties && propertyListError && (
            <section className="panel entity-state-panel error-state">
              <p className="status-message error-message">{propertyListError}</p>
              <button className="secondary-button" type="button" onClick={() => void loadPropertyList()}>
                Tekrar Dene
              </button>
            </section>
          )}

          {!isLoadingProperties && !propertyListError && properties.length === 0 && (
            <section className="panel entity-state-panel">Henüz kayıtlı yapı bulunmuyor.</section>
          )}

          {!isLoadingProperties && !propertyListError && properties.length > 0 && filteredProperties.length === 0 && (
            <section className="panel entity-state-panel">Filtrelere uygun yapı bulunamadı.</section>
          )}

          {!isLoadingProperties && !propertyListError && filteredProperties.length > 0 && (
            <section className="panel entity-table-panel">
              <div className="responsive-table-wrapper">
                <table className="management-table sticky-columns-table">
                  <thead>
                    <tr>
                      <th>Yapı Adı</th>
                      <th>Tür</th>
                      <th>Konum</th>
                      <th>Blok Sayısı</th>
                      <th>Daire Sayısı</th>
                      <th>Durum</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProperties.map((property) => (
                      <tr key={property.id}>
                        <td data-label="Yapı Adı"><strong>{property.name}</strong></td>
                        <td data-label="Tür">
                          {formatPropertyTypeLabel(property)}
                        </td>
                        <td data-label="Konum">{property.city} / {property.district}</td>
                        <td data-label="Blok Sayısı">{property.buildingCount}</td>
                        <td data-label="Daire Sayısı">{property.unitCount}</td>
                        <td data-label="Durum">
                          <span className={`status-badge ${property.isActive ? 'active' : 'inactive'}`}>
                            {property.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        <td data-label="İşlemler">
                          <RowActionsMenu
                            label={property.name}
                            primaryAction={{ label: 'Detay', onSelect: () => { void handleSelectProperty(property) } }}
                            secondaryActions={[
                              ...(canEditProperty ? [{ label: 'Düzenle', onSelect: () => { void handleEditPropertyClick(property) } }] : []),
                              ...(canDeactivateProperty && property.isActive ? [{ label: 'Pasifleştir', danger: true, onSelect: () => { void handleDeactivateProperty(property.id) } }] : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      )}

      {isManagementPanel && activeManagementView === 'buildings' && (
        <section className="section-container entity-management-view">
          <div className="entity-page-actions">
            <p>{filteredBuildings.length} blok gösteriliyor.</p>
            {canCreateBuilding && (
              <button className="primary-button" type="button" onClick={() => void handleOpenNewBuilding()}>
                Yeni Blok
              </button>
            )}
          </div>

          <section className="panel entity-toolbar" aria-label="Blok filtreleri">
            <div className="form-field">
              <label htmlFor="building-search">Blok Ara</label>
              <input
                id="building-search"
                value={buildingSearch}
                onChange={(event) => setBuildingSearch(event.target.value)}
                placeholder="Blok adı veya kodu"
              />
            </div>
            <div className="form-field">
              <label htmlFor="building-property-filter">Bağlı Yapı</label>
              <select
                id="building-property-filter"
                value={buildingPropertyFilter}
                onChange={(event) => setBuildingPropertyFilter(event.target.value)}
              >
                <option value="all">Tüm yapılar</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="building-status-filter">Durum</label>
              <select
                id="building-status-filter"
                value={buildingStatusFilter}
                onChange={(event) => setBuildingStatusFilter(event.target.value)}
              >
                <option value="all">Tüm durumlar</option>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
            <button
              className={`secondary-button entity-filter-clear ${buildingFilterCount > 0 ? 'has-active-filters' : ''}`}
              type="button"
              disabled={buildingFilterCount === 0}
              onClick={() => {
                setBuildingSearch('')
                setBuildingPropertyFilter('all')
                setBuildingStatusFilter('all')
              }}
            >
              <span>Filtreleri Temizle</span>
              {buildingFilterCount > 0 && <span className="filter-count-badge" aria-label={`${buildingFilterCount} aktif filtre`}>{buildingFilterCount}</span>}
            </button>
          </section>

          {isLoadingAllBuildings && (
            <section className="panel entity-state-panel">Bloklar yükleniyor...</section>
          )}

          {!isLoadingAllBuildings && buildingListError && (
            <section className="panel entity-state-panel error-state">
              <p className="status-message error-message">{buildingListError}</p>
              <button className="secondary-button" type="button" onClick={() => void loadAllBuildingList()}>
                Tekrar Dene
              </button>
            </section>
          )}

          {!isLoadingAllBuildings && !buildingListError && allBuildings.length === 0 && (
            <section className="panel entity-state-panel">Henüz kayıtlı blok bulunmuyor.</section>
          )}

          {!isLoadingAllBuildings && !buildingListError && allBuildings.length > 0 && filteredBuildings.length === 0 && (
            <section className="panel entity-state-panel">Filtrelere uygun blok bulunamadı.</section>
          )}

          {!isLoadingAllBuildings && !buildingListError && filteredBuildings.length > 0 && (
            <section className="panel entity-table-panel">
              <div className="responsive-table-wrapper">
                <table className="management-table sticky-columns-table">
                  <thead>
                    <tr>
                      <th>Blok Adı / Kodu</th>
                      <th>Bağlı Yapı</th>
                      <th>Kat Sayısı</th>
                      <th>Daire Sayısı</th>
                      <th>Durum</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBuildings.map((building) => (
                      <tr key={building.id}>
                        <td data-label="Blok Adı / Kodu">
                          <strong>{building.name}</strong>
                          <small className="table-secondary-text">{building.code}</small>
                        </td>
                        <td data-label="Bağlı Yapı">{building.propertyName}</td>
                        <td data-label="Kat Sayısı">{building.floorCount} kat</td>
                        <td data-label="Daire Sayısı">{building.unitCount}</td>
                        <td data-label="Durum">
                          <span className={`status-badge ${building.isActive ? 'active' : 'inactive'}`}>
                            {building.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        <td data-label="İşlemler">
                          <RowActionsMenu
                            label={building.name}
                            primaryAction={{ label: 'Detay', onSelect: () => { void handleSelectBuilding(building) } }}
                            secondaryActions={[
                              ...(canEditBuilding ? [{ label: 'Düzenle', onSelect: () => { void handleEditBuildingClick(building) } }] : []),
                              ...(canDeleteBuilding ? [{ label: 'Sil', danger: true, onSelect: () => { void handleDeleteBuildingClick(building.id) } }] : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      )}

      {isPropertyDrawerOpen && (
        <>
          <button className="drawer-backdrop" type="button" aria-label="Yapı formunu kapat" onClick={() => void handleCancelPropertyEdit()} />
          <aside className="management-drawer" role="dialog" aria-modal="true" aria-labelledby="property-drawer-title">
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Yapı Yönetimi</p>
                <h2 id="property-drawer-title">{editingPropertyId ? 'Yapıyı Düzenle' : 'Yeni Yapı'}</h2>
              </div>
              <button className="drawer-close-button" type="button" aria-label="Kapat" onClick={() => void handleCancelPropertyEdit()}>×</button>
            </div>
            {propertyError && <p className="status-message error-message">{propertyError}</p>}
            <form className="property-form drawer-form" onSubmit={handlePropertySubmit}>
              <div className="form-field form-field-full">
                <label htmlFor="prop-name">Yapı Adı *</label>
                <input id="prop-name" value={propertyForm.name} onChange={(event) => { setPropertyFormDirty(true); setPropertyForm({ ...propertyForm, name: event.target.value }) }} required />
              </div>
              <div className="form-field form-field-full">
                <label htmlFor="prop-type">Yapı Türü *</label>
                <select id="prop-type" value={propertyForm.propertyTypeId || ''} onChange={(event) => { setPropertyFormDirty(true); setPropertyForm({ ...propertyForm, propertyTypeId: event.target.value ? Number(event.target.value) : null }) }} required>
                  <option value="">Tür seçin</option>
                  {propertyTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </div>
              <div className="form-field form-field-full">
                <label htmlFor="prop-address">Adres *</label>
                <input id="prop-address" value={propertyForm.addressLine} onChange={(event) => { setPropertyFormDirty(true); setPropertyForm({ ...propertyForm, addressLine: event.target.value }) }} required />
              </div>
              <div className="form-field">
                <SearchableSelect id="prop-city" label="İl" value={propertyForm.city} options={cityNames} placeholder="İl ara veya seç" required onChange={handleCityChange} />
              </div>
              <div className="form-field">
                <SearchableSelect id="prop-district" label="İlçe" value={propertyForm.district} options={availableDistricts} placeholder="İlçe ara veya seç" disabled={!propertyForm.city} required onChange={handleDistrictChange} />
              </div>
              <div className="form-field form-field-full">
                <label htmlFor="prop-desc">Açıklama</label>
                <textarea id="prop-desc" value={propertyForm.description || ''} onChange={(event) => { setPropertyFormDirty(true); setPropertyForm({ ...propertyForm, description: event.target.value }) }} rows={3} />
              </div>
              {editingPropertyId && (
                <div className="form-field form-field-full checkbox-field">
                  <label htmlFor="prop-is-active"><input id="prop-is-active" type="checkbox" checked={propertyForm.isActive ?? true} onChange={(event) => { setPropertyFormDirty(true); setPropertyForm({ ...propertyForm, isActive: event.target.checked }) }} /><span>Aktif Yapı</span></label>
                </div>
              )}
              <div className="drawer-actions form-field-full">
                <button className="secondary-button" type="button" onClick={() => void handleCancelPropertyEdit()}>Vazgeç</button>
                <button className="primary-button" type="submit" disabled={isSubmittingProperty}>{isSubmittingProperty ? 'Kaydediliyor...' : 'Kaydet'}</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {isBuildingDrawerOpen && (
        <>
          <button className="drawer-backdrop" type="button" aria-label="Blok formunu kapat" onClick={() => void handleCancelBuildingEdit()} />
          <aside className="management-drawer" role="dialog" aria-modal="true" aria-labelledby="building-drawer-title">
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Blok Yönetimi</p>
                <h2 id="building-drawer-title">{editingBuildingId ? 'Bloğu Düzenle' : 'Yeni Blok'}</h2>
              </div>
              <button className="drawer-close-button" type="button" aria-label="Kapat" onClick={() => void handleCancelBuildingEdit()}>×</button>
            </div>
            {buildingError && <p className="status-message error-message">{buildingError}</p>}
            <form className="property-form drawer-form" onSubmit={handleBuildingSubmit}>
              <div className="form-field form-field-full">
                <label htmlFor="building-property">Bağlı Yapı *</label>
                <select id="building-property" value={buildingForm.propertyId || ''} onChange={(event) => { setBuildingFormDirty(true); setBuildingForm({ ...buildingForm, propertyId: Number(event.target.value) }) }} required>
                  <option value="">Yapı seçin</option>
                  {properties.filter((property) => property.isActive || property.id === buildingForm.propertyId).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
              </div>
              {isBuildingFormSingleApartment ? (
                <p className="form-field form-field-full drawer-info-box">Tek apartman yapısında blok bilgileri yapı adına göre otomatik hazırlanır.</p>
              ) : (
                <>
                  <div className="form-field">
                    <label htmlFor="bld-name">Blok Adı *</label>
                    <input id="bld-name" value={buildingForm.name} onChange={(event) => handleBuildingNameChange(event.target.value)} placeholder="Örn: A Blok" required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="bld-code">Blok Kodu *</label>
                    <input id="bld-code" value={buildingForm.code} onChange={(event) => handleBuildingCodeChange(event.target.value)} placeholder="Örn: A" required />
                  </div>
                </>
              )}
              <div className="form-field form-field-full">
                <label htmlFor="bld-floor">Kat Sayısı *</label>
                <input id="bld-floor" type="number" min={1} max={200} value={buildingForm.floorCount} onChange={(event) => { setBuildingFormDirty(true); setBuildingForm({ ...buildingForm, floorCount: Math.floor(Number(event.target.value)) }) }} required />
              </div>
              <div className="form-field form-field-full">
                <label htmlFor="bld-desc">Açıklama</label>
                <textarea id="bld-desc" value={buildingForm.description || ''} onChange={(event) => { setBuildingFormDirty(true); setBuildingForm({ ...buildingForm, description: event.target.value }) }} rows={3} />
              </div>
              {editingBuildingId && (
                <div className="form-field form-field-full checkbox-field">
                  <label htmlFor="bld-is-active"><input id="bld-is-active" type="checkbox" checked={buildingForm.isActive ?? true} onChange={(event) => { setBuildingFormDirty(true); setBuildingForm({ ...buildingForm, isActive: event.target.checked }) }} /><span>Aktif Blok</span></label>
                </div>
              )}
              <div className="drawer-actions form-field-full">
                <button className="secondary-button" type="button" onClick={() => void handleCancelBuildingEdit()}>Vazgeç</button>
                <button className="primary-button" type="submit" disabled={isSubmittingBuilding}>{isSubmittingBuilding ? 'Kaydediliyor...' : 'Kaydet'}</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {isManagementPanel && activeManagementView === 'units' && routeUnitId == null && (
        <section className="section-container entity-management-view">
          <div className="entity-page-actions">
            <p>{filteredUnits.length} daire veya bölüm gösteriliyor.</p>
            {canCreateUnit && (
              <button className="primary-button" type="button" onClick={() => void handleOpenNewUnit()}>
                Yeni Daire
              </button>
            )}
          </div>

          <section className="panel entity-toolbar unit-toolbar" aria-label="Daire filtreleri">
            <div className="form-field">
              <label htmlFor="unit-search">Daire / Bölüm No</label>
              <input id="unit-search" value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Numaraya göre ara" />
            </div>
            <div className="form-field">
              <label htmlFor="unit-property-filter">Yapı</label>
              <select id="unit-property-filter" value={unitPropertyFilter} onChange={(event) => { setUnitPropertyFilter(event.target.value); setUnitBuildingFilter('all') }}>
                <option value="all">Tüm yapılar</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="unit-building-filter">Blok / Bina</label>
              <select id="unit-building-filter" value={unitBuildingFilter} onChange={(event) => setUnitBuildingFilter(event.target.value)}>
                <option value="all">Tüm bloklar</option>
                {unitFilterBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="unit-floor-filter">Kat</label>
              <select id="unit-floor-filter" value={unitFloorFilter} onChange={(event) => setUnitFloorFilter(event.target.value)}>
                <option value="all">Tüm katlar</option>
                {unitFloorOptions.map((floor) => <option key={floor} value={floor}>{formatFloorDisplay(floor)}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="unit-occupancy-filter">Doluluk</label>
              <select id="unit-occupancy-filter" value={unitOccupancyFilter} onChange={(event) => setUnitOccupancyFilter(event.target.value)}>
                <option value="all">Tümü</option>
                <option value="occupied">Dolu</option>
                <option value="vacant">Boş</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="unit-status-filter">Durum</label>
              <select id="unit-status-filter" value={unitStatusFilter} onChange={(event) => setUnitStatusFilter(event.target.value)}>
                <option value="all">Tüm durumlar</option>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
            <button className={`secondary-button entity-filter-clear ${unitFilterCount > 0 ? 'has-active-filters' : ''}`} type="button" disabled={unitFilterCount === 0} onClick={() => { setUnitSearch(''); setUnitPropertyFilter('all'); setUnitBuildingFilter('all'); setUnitFloorFilter('all'); setUnitOccupancyFilter('all'); setUnitStatusFilter('all') }}>
              <span>Filtreleri Temizle</span>
              {unitFilterCount > 0 && <span className="filter-count-badge" aria-label={`${unitFilterCount} aktif filtre`}>{unitFilterCount}</span>}
            </button>
          </section>

          {isLoadingCentralUnits && <section className="panel entity-state-panel">Daireler yükleniyor...</section>}
          {!isLoadingCentralUnits && centralUnitError && (
            <section className="panel entity-state-panel error-state">
              <p className="status-message error-message">{centralUnitError}</p>
              <button className="secondary-button" type="button" onClick={() => void Promise.all([loadAllUnitList(), loadAllBuildingList()])}>Tekrar Dene</button>
            </section>
          )}
          {!isLoadingCentralUnits && !centralUnitError && allUnits.length === 0 && <section className="panel entity-state-panel">Henüz kayıtlı daire veya bölüm bulunmuyor.</section>}
          {!isLoadingCentralUnits && !centralUnitError && allUnits.length > 0 && filteredUnits.length === 0 && <section className="panel entity-state-panel">Filtrelere uygun daire bulunamadı.</section>}

          {!isLoadingCentralUnits && !centralUnitError && filteredUnits.length > 0 && (
            <section className="panel entity-table-panel">
              <div className="responsive-table-wrapper">
                <table className="management-table unit-management-table sticky-columns-table">
                  <thead><tr><th>Daire / Bölüm No</th><th>Yapı</th><th>Blok / Bina</th><th>Kat</th><th>Tür</th><th>Brüt Alan</th><th>Net Alan</th><th>Doluluk</th><th>Durum</th><th>İşlemler</th></tr></thead>
                  <tbody>
                    {filteredUnits.map((unit) => (
                      <tr key={unit.id}>
                        <td><strong>{formatUnitNumber(unit.unitNumber)}</strong></td>
                        <td>{unit.propertyName}</td>
                        <td>{unit.buildingName}</td>
                        <td>{formatFloorDisplay(unit.floorNumber)}</td>
                        <td>{unit.unitTypeName}</td>
                        <td>{unit.grossArea != null ? `${unit.grossArea} m²` : '—'}</td>
                        <td>{unit.netArea != null ? `${unit.netArea} m²` : '—'}</td>
                        <td><span className={`occupancy-state ${unit.activeOccupancyCount > 0 ? 'occupied' : 'vacant'}`}>{unit.activeOccupancyCount > 0 ? `Dolu (${unit.activeOccupancyCount})` : 'Boş'}</span></td>
                        <td><span className={`status-badge ${unit.isActive ? 'active' : 'inactive'}`}>{unit.isActive ? 'Aktif' : 'Pasif'}</span></td>
                        <td>
                          <RowActionsMenu
                            label={formatUnitNumber(unit.unitNumber)}
                            primaryAction={{ label: 'Detay', onSelect: () => { void handleOpenUnitDetail(unit) } }}
                            secondaryActions={[
                              ...(canEditUnit ? [{ label: 'Düzenle', onSelect: () => { void handleEditUnitClick(unit) } }] : []),
                              ...(canManageOccupancies ? [{ label: 'Sakinleri Yönet', onSelect: () => { void handleOpenUnitDetail(unit, 'residents') } }] : []),
                              ...(canDeleteUnit ? [{ label: 'Sil', danger: true, onSelect: () => { void handleDeleteUnitClick(unit.id) } }] : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      )}

      {isManagementPanel && activeManagementView === 'units' && routeUnitId != null && !selectedUnitDetail && (
        <section className="section-container unit-detail-view">
          <section className="panel entity-state-panel">
            {!hasLoadedAllUnits || isLoadingAllUnits ? (
              <p>Daire detayı yükleniyor...</p>
            ) : unitListError ? (
              <>
                <p className="status-message error-message">{unitListError}</p>
                <button className="secondary-button" type="button" onClick={() => void loadAllUnitList()}>
                  Tekrar Dene
                </button>
              </>
            ) : (
              <>
                <p className="status-message error-message">İstenen daire bulunamadı.</p>
                <button className="secondary-button" type="button" onClick={() => void handleCloseUnitDetail()}>
                  Daire Listesine Dön
                </button>
              </>
            )}
          </section>
        </section>
      )}

      {isManagementPanel && activeManagementView === 'units' && routeUnitId != null && selectedUnitDetail && (
        <section className="section-container unit-detail-view">
          <div className="unit-detail-heading">
            <div>
              <p className="eyebrow">Daire Detayı</p>
              <h2>{formatUnitDisplay(selectedUnitDetail.unitNumber, selectedUnitDetail.unitTypeName)}</h2>
              <p>{selectedUnitDetail.propertyName} · {selectedUnitDetail.buildingName}</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => void handleCloseUnitDetail()}>Daire Listesine Dön</button>
          </div>
          <div className="detail-tabs" role="tablist" aria-label="Daire detay bölümleri">
            <button className={unitDetailTab === 'general' ? 'active' : ''} type="button" role="tab" aria-selected={unitDetailTab === 'general'} onClick={() => void handleUnitDetailTabChange('general')}>Genel Bilgiler</button>
            <button className={unitDetailTab === 'residents' ? 'active' : ''} type="button" role="tab" aria-selected={unitDetailTab === 'residents'} onClick={() => void handleUnitDetailTabChange('residents')}>Sakinler</button>
          </div>
          {unitDetailTab === 'general' && (
            <section className="panel unit-general-panel">
              <dl className="unit-general-grid">
                <div><dt>Yapı</dt><dd>{selectedUnitDetail.propertyName}</dd></div>
                <div><dt>Blok / Bina</dt><dd>{selectedUnitDetail.buildingName}</dd></div>
                <div><dt>Daire / Bölüm No</dt><dd>{formatUnitNumber(selectedUnitDetail.unitNumber)}</dd></div>
                <div><dt>Kat</dt><dd>{formatFloorDisplay(selectedUnitDetail.floorNumber)}</dd></div>
                <div><dt>Tür</dt><dd>{selectedUnitDetail.unitTypeName}</dd></div>
                <div><dt>Doluluk</dt><dd>{selectedUnitDetail.activeOccupancyCount > 0 ? `Dolu (${selectedUnitDetail.activeOccupancyCount} aktif sakin)` : 'Boş'}</dd></div>
                <div><dt>Brüt Alan</dt><dd>{selectedUnitDetail.grossArea != null ? `${selectedUnitDetail.grossArea} m²` : 'Belirtilmemiş'}</dd></div>
                <div><dt>Net Alan</dt><dd>{selectedUnitDetail.netArea != null ? `${selectedUnitDetail.netArea} m²` : 'Belirtilmemiş'}</dd></div>
                <div><dt>Durum</dt><dd>{selectedUnitDetail.isActive ? 'Aktif' : 'Pasif'}</dd></div>
                <div className="wide"><dt>Açıklama</dt><dd>{selectedUnitDetail.description || 'Açıklama bulunmuyor.'}</dd></div>
              </dl>
              {canEditUnit && <button className="primary-button detail-edit-button" type="button" onClick={() => void handleEditUnitClick(selectedUnitDetail)}>Düzenle</button>}
            </section>
          )}
          {unitDetailTab === 'residents' && canManageOccupancies && (
            <OccupancyErrorBoundary key={selectedUnitDetail.id} onClose={() => void handleCloseUnitDetail()}>
              <OccupancyManagement unit={selectedUnitDetail} onClose={() => void handleCloseUnitDetail()} onDirtyChange={handleOccupancyDirtyChange} />
            </OccupancyErrorBoundary>
          )}
        </section>
      )}

      {isUnitDrawerOpen && (
        <>
          <button className="drawer-backdrop" type="button" aria-label="Daire formunu kapat" onClick={() => void handleCancelUnitEdit()} />
          <aside className="management-drawer" role="dialog" aria-modal="true" aria-labelledby="unit-drawer-title">
            <div className="drawer-header"><div><p className="eyebrow">Daire Yönetimi</p><h2 id="unit-drawer-title">{editingUnitId ? 'Daireyi Düzenle' : 'Yeni Daire'}</h2></div><button className="drawer-close-button" type="button" aria-label="Kapat" onClick={() => void handleCancelUnitEdit()}>×</button></div>
            {unitError && <p className="status-message error-message">{unitError}</p>}
            <form className="property-form drawer-form" onSubmit={handleUnitSubmit}>
              <div className="form-field"><label htmlFor="unit-property">Yapı *</label><select id="unit-property" value={unitFormPropertyId || ''} onChange={(event) => { const propertyId = Number(event.target.value); const firstBuilding = allBuildings.find((building) => building.propertyId === propertyId && building.isActive); setUnitFormDirty(true); setUnitFormPropertyId(propertyId); setUnitForm({ ...unitForm, buildingId: firstBuilding?.id || 0 }) }} required><option value="">Yapı seçin</option>{properties.filter((property) => property.isActive || property.id === unitFormPropertyId).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div>
              <div className="form-field"><label htmlFor="unit-building">Blok / Bina *</label><select id="unit-building" value={unitForm.buildingId || ''} onChange={(event) => { setUnitFormDirty(true); setUnitForm({ ...unitForm, buildingId: Number(event.target.value) }) }} disabled={!unitFormPropertyId} required><option value="">Blok seçin</option>{unitFormBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></div>
              <div className="form-field"><label htmlFor="unit-number">Daire / Bölüm No *</label><input id="unit-number" value={unitForm.unitNumber} onChange={(event) => { setUnitFormDirty(true); setUnitForm({ ...unitForm, unitNumber: event.target.value }) }} required /></div>
              <div className="form-field"><label htmlFor="unit-type">Bölüm Türü *</label><select id="unit-type" value={unitForm.unitTypeId || ''} onChange={(event) => { setUnitFormDirty(true); setUnitForm({ ...unitForm, unitTypeId: Number(event.target.value) }) }} required><option value="">Tür seçin</option>{selectableUnitTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div>
              <div className="form-field"><label htmlFor="unit-floor">Kat No *</label><input id="unit-floor" type="number" value={unitForm.floorNumber} onChange={(event) => { setUnitFormDirty(true); setUnitForm({ ...unitForm, floorNumber: Math.floor(Number(event.target.value)) }) }} required /><small className="field-help">0: Zemin, negatif: bodrum, pozitif: normal kat</small></div>
              <div className="form-field"><label htmlFor="unit-gross">Brüt Alan (m²)</label><input id="unit-gross" type="number" step="0.01" min="0.01" value={unitForm.grossArea ?? ''} onChange={(event) => { setUnitFormDirty(true); setUnitForm({ ...unitForm, grossArea: event.target.value ? Number(event.target.value) : null }) }} /></div>
              <div className="form-field"><label htmlFor="unit-net">Net Alan (m²)</label><input id="unit-net" type="number" step="0.01" min="0.01" value={unitForm.netArea ?? ''} onChange={(event) => { setUnitFormDirty(true); setUnitForm({ ...unitForm, netArea: event.target.value ? Number(event.target.value) : null }) }} /></div>
              <div className="form-field form-field-full"><label htmlFor="unit-desc">Açıklama</label><textarea id="unit-desc" value={unitForm.description || ''} onChange={(event) => { setUnitFormDirty(true); setUnitForm({ ...unitForm, description: event.target.value }) }} rows={3} /></div>
              {editingUnitId && <div className="form-field form-field-full checkbox-field"><label htmlFor="unit-is-active"><input id="unit-is-active" type="checkbox" checked={unitForm.isActive ?? true} onChange={(event) => { setUnitFormDirty(true); setUnitForm({ ...unitForm, isActive: event.target.checked }) }} /><span>Aktif Daire</span></label></div>}
              <div className="drawer-actions form-field-full"><button className="secondary-button" type="button" onClick={() => void handleCancelUnitEdit()}>Vazgeç</button><button className="primary-button" type="submit" disabled={isSubmittingUnit}>{isSubmittingUnit ? 'Kaydediliyor...' : 'Kaydet'}</button></div>
            </form>
          </aside>
        </>
      )}

      {/* SECTION 1: PROPERTIES */}
      {showPropertySection && !isManagementPanel && <section className="section-container">
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
      {showBuildingSection && !isManagementPanel && selectedProperty && (
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
                      <small className="field-help">
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
      {showUnitSection && !isManagementPanel && selectedBuilding && (
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
                    <small className="field-help">
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
