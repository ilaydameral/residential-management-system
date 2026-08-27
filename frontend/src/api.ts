import { API_BASE_URL } from './config'
import type { PagedActivityFeedDto } from './realtime/types'
import type {
  ApiErrorResponse,
  GlobalSearchResponse,
  AccountProfile,
  AuthenticatedUser,
  Building,
  CreateManagerAssignmentPayload,
  CreateBuildingPayload,
  CreateManagedUserPayload,
  CreatePropertyPayload,
  CreateUnitOccupancyPayload,
  CreateUnitPayload,
  DashboardSummary,
  EndUnitOccupancyPayload,
  EndManagerAssignmentPayload,
  LoginRequest,
  LoginResponse,
  ManagedUser,
  ManagedUserDetail,
  ManagerAssignment,
  OccupancyType,
  Property,
  PropertyType,
  ResidentUnit,
  RegisterRequest,
  Role,
  Unit,
  UnitOccupancy,
  UnitType,
  UpdateBuildingPayload,
  UpdateAccountProfilePayload,
  ChangeAccountPasswordPayload,
  UpdateManagedUserPayload,
  UpdatePropertyPayload,
  UpdateUnitOccupancyPayload,
  UpdateUnitPayload,
  UpdateUserRolesPayload,
  UserSearchResult,
  ManagementFinanceSummaryDto,
  MonthlyCollectionSummaryDto,
  UnitOutstandingReportDto,
  ResidentFinanceSummaryDto,
  DueDefinition,
  CreateDueDefinitionPayload,
  UpdateDueDefinitionPayload,
  DuePeriod,
  CreateDraftDuePeriodPayload,
  DuePeriodCollectionDetailsDto,
  IssuePeriodPreview,
  IssuePeriodResult,
  CancelDuePeriodPayload,
  Expense,
  CreateExpensePayload,
  UpdateExpensePayload,
  CancelExpensePayload,
  ApportionExpensePayload,
  ExpenseApportionmentPreview,
  ApportionExpenseResult,
  PaymentSubmission,
  ApprovePaymentSubmissionPayload,
  RejectPaymentSubmissionPayload,
  NotificationDto,
  UnreadNotificationCountDto,
  ResidentUnitCharge,
  ImportUploadResponse,
  ImportColumnMappingOptions,
  ValidateImportBatchPayload,
  ImportPreviewResponse,
  ImportConfirmResponse,
  ImportSummaryResponse,
  ImportRollbackResponse,
  ImportBatchListResponse,
  AnnouncementDto,
  AnnouncementListResponseDto,
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  MaintenanceRequestDetailDto,
  MaintenanceRequestAttachmentDto,
  MaintenanceRequestListResponseDto,
  CommonFacility,
  CreateCommonFacilityPayload,
  UpdateCommonFacilityPayload,
  FacilityReservation,
  CreateReservationPayload,
  ReviewReservationPayload,
  FacilityMaintenanceBlock,
  CreateMaintenanceBlockPayload,
  FacilityAvailability,
  Visitor,
  CreateVisitorPayload,
  PagedVisitorResult,
  ResidentVehicle,
  CreateResidentVehiclePayload,
  UpdateResidentVehiclePayload,
  PagedResidentVehicleResult,
} from './types'

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('rms_access_token')
  const headers: Record<string, string> = { ...customHeaders }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (error: unknown) {
    throw new Error('Sunucuya ulaşılamadı. Backend servisinin çalıştığını kontrol edin.')
  }
}

async function handleResponse<T>(response: Response, isAuthEndpoint = false): Promise<T> {
  if (response.status === 401) {
    if (!isAuthEndpoint && unauthorizedHandler) {
      unauthorizedHandler()
    }
    let errorText = isAuthEndpoint
      ? 'Kullanıcı adı/e-posta veya parola hatalı.'
      : 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.'
    try {
      const errorJson: ApiErrorResponse = await response.json()
      if (errorJson.message) {
        errorText = errorJson.message
      }
    } catch {
      // fallback message
    }
    throw new Error(errorText)
  }

  if (!response.ok) {
    let errorText = 'Sunucuda bir hata oluştu.'
    try {
      const errorJson: ApiErrorResponse = await response.json()
      if (errorJson.message) {
        errorText = errorJson.message
      } else if (errorJson.errors) {
        const firstErrorKey = Object.keys(errorJson.errors)[0]
        if (firstErrorKey && errorJson.errors[firstErrorKey]?.[0]) {
          errorText = errorJson.errors[firstErrorKey][0]
        }
      }
    } catch {
      errorText = `İstek başarısız oldu (HTTP ${response.status}).`
    }
    throw new Error(errorText)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// Auth API
export async function loginApi(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await safeFetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
  return handleResponse<LoginResponse>(response, true)
}

export async function registerApi(payload: RegisterRequest): Promise<AuthenticatedUser> {
  const response = await safeFetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<AuthenticatedUser>(response, true)
}

// Property Types API
export async function getPropertyTypes(includeInactive = false): Promise<PropertyType[]> {
  const url = `${API_BASE_URL}/api/property-types${includeInactive ? '?includeInactive=true' : ''}`
  const response = await safeFetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<PropertyType[]>(response)
}

// Unit Types API
export async function getUnitTypes(includeInactive = false): Promise<UnitType[]> {
  const url = `${API_BASE_URL}/api/unit-types${includeInactive ? '?includeInactive=true' : ''}`
  const response = await safeFetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<UnitType[]>(response)
}

export async function getOccupancyTypes(): Promise<OccupancyType[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/occupancy-types`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<OccupancyType[]>(response)
}

// Properties API
export async function getProperties(includeInactive = true): Promise<Property[]> {
  const url = `${API_BASE_URL}/api/properties${includeInactive ? '?includeInactive=true' : ''}`
  const response = await safeFetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Property[]>(response)
}

export async function createProperty(payload: CreatePropertyPayload): Promise<Property> {
  const response = await safeFetch(`${API_BASE_URL}/api/properties`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Property>(response)
}

export async function updateProperty(id: number, payload: UpdatePropertyPayload): Promise<Property> {
  const response = await safeFetch(`${API_BASE_URL}/api/properties/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Property>(response)
}

export async function deactivateProperty(id: number): Promise<void> {
  const response = await safeFetch(`${API_BASE_URL}/api/properties/${id}/deactivate`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  })
  await handleResponse<void>(response)
}

// Buildings API
export async function getBuildings(includeInactive = true): Promise<Building[]> {
  const url = `${API_BASE_URL}/api/buildings${includeInactive ? '?includeInactive=true' : ''}`
  const response = await safeFetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Building[]>(response)
}

export async function getBuildingsByProperty(propertyId: number, includeInactive = true): Promise<Building[]> {
  const url = `${API_BASE_URL}/api/buildings/property/${propertyId}${includeInactive ? '?includeInactive=true' : ''}`
  const response = await safeFetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Building[]>(response)
}

export async function createBuilding(payload: CreateBuildingPayload): Promise<Building> {
  const response = await safeFetch(`${API_BASE_URL}/api/buildings`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Building>(response)
}

export async function updateBuilding(id: number, payload: UpdateBuildingPayload): Promise<Building> {
  const response = await safeFetch(`${API_BASE_URL}/api/buildings/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Building>(response)
}

export async function deleteBuilding(id: number): Promise<void> {
  const response = await safeFetch(`${API_BASE_URL}/api/buildings/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  await handleResponse<void>(response)
}

// Units API
export async function getUnits(includeInactive = true): Promise<Unit[]> {
  const url = `${API_BASE_URL}/api/units${includeInactive ? '?includeInactive=true' : ''}`
  const response = await safeFetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Unit[]>(response)
}

export async function getUnitsByBuilding(buildingId: number, includeInactive = true): Promise<Unit[]> {
  const url = `${API_BASE_URL}/api/units/building/${buildingId}${includeInactive ? '?includeInactive=true' : ''}`
  const response = await safeFetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Unit[]>(response)
}

export async function getUnitsByProperty(propertyId: number, includeInactive = true): Promise<Unit[]> {
  const url = `${API_BASE_URL}/api/units/property/${propertyId}${includeInactive ? '?includeInactive=true' : ''}`
  const response = await safeFetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Unit[]>(response)
}

export async function createUnit(payload: CreateUnitPayload): Promise<Unit> {
  const response = await safeFetch(`${API_BASE_URL}/api/units`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Unit>(response)
}

export async function updateUnit(id: number, payload: UpdateUnitPayload): Promise<Unit> {
  const response = await safeFetch(`${API_BASE_URL}/api/units/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Unit>(response)
}

export async function deleteUnit(id: number): Promise<void> {
  const response = await safeFetch(`${API_BASE_URL}/api/units/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  await handleResponse<void>(response)
}

// Resident Units API
export async function getMyUnits(): Promise<ResidentUnit[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/my-units`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ResidentUnit[]>(response)
}

export async function getMyAccountProfile(): Promise<AccountProfile> {
  const response = await safeFetch(`${API_BASE_URL}/api/account/me`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<AccountProfile>(response)
}

export async function updateMyAccountProfile(payload: UpdateAccountProfilePayload): Promise<AccountProfile> {
  const response = await safeFetch(`${API_BASE_URL}/api/account/profile`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<AccountProfile>(response)
}

export async function changeMyAccountPassword(payload: ChangeAccountPasswordPayload): Promise<void> {
  const response = await safeFetch(`${API_BASE_URL}/api/account/password`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  await handleResponse<void>(response)
}

// Unit Occupancies API
export async function getAllUnitOccupancies(): Promise<UnitOccupancy[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/unit-occupancies`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<UnitOccupancy[]>(response)
}

export async function getUnitOccupancies(
  unitId: number,
  includeInactive = true
): Promise<UnitOccupancy[]> {
  const url = `${API_BASE_URL}/api/units/${unitId}/occupancies${
    includeInactive ? '?includeInactive=true' : ''
  }`
  const response = await safeFetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<UnitOccupancy[]>(response)
}

export async function createUnitOccupancy(
  unitId: number,
  payload: CreateUnitOccupancyPayload
): Promise<UnitOccupancy> {
  const response = await safeFetch(`${API_BASE_URL}/api/units/${unitId}/occupancies`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<UnitOccupancy>(response)
}

export async function updateUnitOccupancy(
  id: number,
  payload: UpdateUnitOccupancyPayload
): Promise<UnitOccupancy> {
  const response = await safeFetch(`${API_BASE_URL}/api/unit-occupancies/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<UnitOccupancy>(response)
}

export async function closeUnitOccupancy(
  id: number,
  payload: EndUnitOccupancyPayload
): Promise<UnitOccupancy> {
  const response = await safeFetch(`${API_BASE_URL}/api/unit-occupancies/${id}/close`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<UnitOccupancy>(response)
}

// Safe User Search API
export async function getUsers(params?: { search?: string; role?: string; isActive?: boolean }): Promise<ManagedUser[]> {
  const query = new URLSearchParams()
  if (params?.search) query.append('search', params.search)
  if (params?.role) query.append('role', params.role)
  if (params?.isActive !== undefined) query.append('isActive', params.isActive.toString())
  const queryString = query.toString() ? `?${query.toString()}` : ''

  const response = await safeFetch(`${API_BASE_URL}/api/users${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ManagedUser[]>(response)
}

export async function getManagedUserDetail(id: number): Promise<ManagedUserDetail> {
  const response = await safeFetch(`${API_BASE_URL}/api/users/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ManagedUserDetail>(response)
}

export async function createManagedUser(payload: CreateManagedUserPayload): Promise<ManagedUser> {
  const response = await safeFetch(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ManagedUser>(response)
}

export async function updateManagedUser(id: number, payload: UpdateManagedUserPayload): Promise<ManagedUser> {
  const response = await safeFetch(`${API_BASE_URL}/api/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ManagedUser>(response)
}

export async function setManagedUserActive(id: number, isActive: boolean): Promise<ManagedUser> {
  const action = isActive ? 'activate' : 'deactivate'
  const response = await safeFetch(`${API_BASE_URL}/api/users/${id}/${action}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  })
  return handleResponse<ManagedUser>(response)
}

export async function updateManagedUserRoles(id: number, payload: UpdateUserRolesPayload): Promise<ManagedUser> {
  const response = await safeFetch(`${API_BASE_URL}/api/users/${id}/roles`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ManagedUser>(response)
}

export async function getRoles(): Promise<Role[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/roles`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Role[]>(response)
}

export async function searchUsers(
  paramsOrQuery: string | { query?: string; role?: string; includeInactive?: boolean }
): Promise<UserSearchResult[]> {
  const queryParams = new URLSearchParams()
  if (typeof paramsOrQuery === 'string') {
    queryParams.append('query', paramsOrQuery.trim())
  } else {
    if (paramsOrQuery.query) queryParams.append('query', paramsOrQuery.query.trim())
    if (paramsOrQuery.role) queryParams.append('role', paramsOrQuery.role.trim())
    if (paramsOrQuery.includeInactive !== undefined) {
      queryParams.append('includeInactive', paramsOrQuery.includeInactive.toString())
    }
  }

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/users/search${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<UserSearchResult[]>(response)
}

// Dashboard API
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await safeFetch(`${API_BASE_URL}/api/dashboard/summary`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<DashboardSummary>(response)
}

export async function getActivityFeed(page: number = 1, pageSize: number = 6): Promise<PagedActivityFeedDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/dashboard/activity-feed?page=${page}&pageSize=${pageSize}`, {
    headers: getAuthHeaders(),
  })
  const data = await handleResponse<any>(response)

  if (Array.isArray(data)) {
    const totalCount = data.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const pagedItems = data.slice((page - 1) * pageSize, page * pageSize)
    return {
      items: pagedItems,
      page,
      pageSize,
      totalCount,
      totalPages,
    }
  }

  return data as PagedActivityFeedDto
}

// Manager Assignments API
export async function getManagerAssignments(): Promise<ManagerAssignment[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/manager-assignments`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ManagerAssignment[]>(response)
}

export async function getMyManagerScope(): Promise<ManagerAssignment[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/manager-assignments/my-scope`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ManagerAssignment[]>(response)
}

export async function getManagerAssignment(id: number): Promise<ManagerAssignment> {
  const response = await safeFetch(`${API_BASE_URL}/api/manager-assignments/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ManagerAssignment>(response)
}

export async function createManagerAssignment(
  payload: CreateManagerAssignmentPayload
): Promise<ManagerAssignment> {
  const response = await safeFetch(`${API_BASE_URL}/api/manager-assignments`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ManagerAssignment>(response)
}

export async function endManagerAssignment(
  id: number,
  payload: EndManagerAssignmentPayload
): Promise<ManagerAssignment> {
  const response = await safeFetch(`${API_BASE_URL}/api/manager-assignments/${id}/end`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ManagerAssignment>(response)
}

// ============================================================================
// Phase 8: Financial Reporting & Management API Client Methods
// ============================================================================

export async function getManagementFinanceSummary(): Promise<ManagementFinanceSummaryDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/finance/reporting/summary`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ManagementFinanceSummaryDto>(response)
}

export async function getMonthlyCollectionSummary(): Promise<MonthlyCollectionSummaryDto[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/finance/reporting/monthly-collections`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<MonthlyCollectionSummaryDto[]>(response)
}

export async function getHighestOutstandingUnits(count = 10): Promise<UnitOutstandingReportDto[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/finance/reporting/highest-outstanding-units?count=${count}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<UnitOutstandingReportDto[]>(response)
}

export async function getResidentFinanceSummary(): Promise<ResidentFinanceSummaryDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/finance/reporting/summary`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ResidentFinanceSummaryDto>(response)
}

// Due Definitions API
export async function getDueDefinitions(params?: {
  propertyId?: number
  buildingId?: number
  isActive?: boolean
}): Promise<DueDefinition[]> {
  const query = new URLSearchParams()
  if (params?.propertyId) query.append('propertyId', params.propertyId.toString())
  if (params?.buildingId) query.append('buildingId', params.buildingId.toString())
  if (params?.isActive !== undefined) query.append('isActive', params.isActive.toString())
  const queryString = query.toString() ? `?${query.toString()}` : ''

  const response = await safeFetch(`${API_BASE_URL}/api/due-definitions${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<DueDefinition[]>(response)
}

export async function getDueDefinitionById(id: number): Promise<DueDefinition> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-definitions/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<DueDefinition>(response)
}

export async function createDueDefinition(payload: CreateDueDefinitionPayload): Promise<DueDefinition> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-definitions`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<DueDefinition>(response)
}

export async function updateDueDefinition(id: number, payload: UpdateDueDefinitionPayload): Promise<DueDefinition> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-definitions/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<DueDefinition>(response)
}

export async function activateDueDefinition(id: number): Promise<DueDefinition> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-definitions/${id}/activate`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  })
  return handleResponse<DueDefinition>(response)
}

export async function deactivateDueDefinition(id: number): Promise<DueDefinition> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-definitions/${id}/deactivate`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  })
  return handleResponse<DueDefinition>(response)
}

// Due Periods API
export async function getDuePeriods(params?: {
  dueDefinitionId?: number
  year?: number
  month?: number
  status?: string
}): Promise<DuePeriod[]> {
  const query = new URLSearchParams()
  if (params?.dueDefinitionId) query.append('dueDefinitionId', params.dueDefinitionId.toString())
  if (params?.year) query.append('year', params.year.toString())
  if (params?.month) query.append('month', params.month.toString())
  if (params?.status) query.append('status', params.status)
  const queryString = query.toString() ? `?${query.toString()}` : ''

  const response = await safeFetch(`${API_BASE_URL}/api/due-periods${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<DuePeriod[]>(response)
}

export async function getDuePeriodById(id: number): Promise<DuePeriod> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-periods/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<DuePeriod>(response)
}

export async function createDraftDuePeriod(payload: CreateDraftDuePeriodPayload): Promise<DuePeriod> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-periods`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<DuePeriod>(response)
}

export async function getIssuePeriodPreview(id: number): Promise<IssuePeriodPreview> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-periods/${id}/preview`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<IssuePeriodPreview>(response)
}

export async function issueDuePeriod(id: number): Promise<IssuePeriodResult> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-periods/${id}/issue`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<IssuePeriodResult>(response)
}

export async function cancelDraftDuePeriod(id: number, payload: CancelDuePeriodPayload): Promise<DuePeriod> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-periods/${id}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<DuePeriod>(response)
}

export async function getDuePeriodCollectionDetails(id: number): Promise<DuePeriodCollectionDetailsDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/due-periods/${id}/collection-details`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<DuePeriodCollectionDetailsDto>(response)
}

// Expenses API
export async function getExpenses(params?: {
  propertyId?: number
  buildingId?: number
  category?: string
  isCancelled?: boolean
  isApportioned?: boolean
}): Promise<Expense[]> {
  const query = new URLSearchParams()
  if (params?.propertyId) query.append('propertyId', params.propertyId.toString())
  if (params?.buildingId) query.append('buildingId', params.buildingId.toString())
  if (params?.category) query.append('category', params.category)
  if (params?.isCancelled !== undefined) query.append('isCancelled', params.isCancelled.toString())
  if (params?.isApportioned !== undefined) query.append('isApportioned', params.isApportioned.toString())
  const queryString = query.toString() ? `?${query.toString()}` : ''

  const response = await safeFetch(`${API_BASE_URL}/api/expenses${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Expense[]>(response)
}

export async function getExpenseById(id: number): Promise<Expense> {
  const response = await safeFetch(`${API_BASE_URL}/api/expenses/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Expense>(response)
}

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const response = await safeFetch(`${API_BASE_URL}/api/expenses`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Expense>(response)
}

export async function updateExpense(id: number, payload: UpdateExpensePayload): Promise<Expense> {
  const response = await safeFetch(`${API_BASE_URL}/api/expenses/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Expense>(response)
}

export async function cancelExpense(id: number, payload: CancelExpensePayload): Promise<Expense> {
  const response = await safeFetch(`${API_BASE_URL}/api/expenses/${id}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Expense>(response)
}

export async function getApportionmentPreview(id: number, payload: ApportionExpensePayload): Promise<ExpenseApportionmentPreview> {
  const response = await safeFetch(`${API_BASE_URL}/api/expenses/${id}/apportionment-preview`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ExpenseApportionmentPreview>(response)
}

export async function apportionExpense(id: number, payload: ApportionExpensePayload): Promise<ApportionExpenseResult> {
  const response = await safeFetch(`${API_BASE_URL}/api/expenses/${id}/apportion`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ApportionExpenseResult>(response)
}

// Management Payment Submissions API
export async function getManagementPaymentSubmissions(params?: {
  status?: string
  propertyId?: number
  buildingId?: number
  unitId?: number
}): Promise<PaymentSubmission[]> {
  const query = new URLSearchParams()
  if (params?.status) query.append('status', params.status)
  if (params?.propertyId) query.append('propertyId', params.propertyId.toString())
  if (params?.buildingId) query.append('buildingId', params.buildingId.toString())
  if (params?.unitId) query.append('unitId', params.unitId.toString())
  const queryString = query.toString() ? `?${query.toString()}` : ''

  const response = await safeFetch(`${API_BASE_URL}/api/management/payment-submissions${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<PaymentSubmission[]>(response)
}

export async function getManagementPaymentSubmissionById(id: number): Promise<PaymentSubmission> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/payment-submissions/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<PaymentSubmission>(response)
}

export async function approvePaymentSubmission(id: number, payload: ApprovePaymentSubmissionPayload): Promise<PaymentSubmission> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/payment-submissions/${id}/approve`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<PaymentSubmission>(response)
}

export async function rejectPaymentSubmission(id: number, payload: RejectPaymentSubmissionPayload): Promise<PaymentSubmission> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/payment-submissions/${id}/reject`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<PaymentSubmission>(response)
}

export async function getPaymentSubmissionReceiptFile(id: number): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/payment-submissions/${id}/receipt`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    await handleResponse(response)
  }
  const blob = await response.blob()
  const contentType = response.headers.get('Content-Type') || blob.type || 'application/octet-stream'
  const contentDisposition = response.headers.get('Content-Disposition')
  let fileName = `receipt_${id}`
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;'"\n]+)['"]?/)
    if (match && match[1]) {
      fileName = decodeURIComponent(match[1])
    }
  }
  return { blob, fileName, contentType }
}

// Notifications API
export async function getNotifications(includeDismissed = false): Promise<NotificationDto[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/notifications?includeDismissed=${includeDismissed}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<NotificationDto[]>(response)
}

export async function getUnreadNotificationCount(): Promise<UnreadNotificationCountDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/notifications/unread-count`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<UnreadNotificationCountDto>(response)
}

export async function markNotificationAsRead(id: number): Promise<NotificationDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<NotificationDto>(response)
}

export async function markAllNotificationsAsRead(): Promise<{ updatedCount: number }> {
  const response = await safeFetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<{ updatedCount: number }>(response)
}

export async function dismissNotification(id: number): Promise<NotificationDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/notifications/${id}/dismiss`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<NotificationDto>(response)
}

// Resident Finance API
export async function getResidentUnitCharges(): Promise<ResidentUnitCharge[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/finance/unit-charges`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ResidentUnitCharge[]>(response)
}

export async function getResidentUnitChargeById(id: number): Promise<ResidentUnitCharge> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/finance/unit-charges/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ResidentUnitCharge>(response)
}

export async function createResidentPaymentSubmission(formData: FormData): Promise<PaymentSubmission> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/finance/payment-submissions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })
  return handleResponse<PaymentSubmission>(response)
}

export async function getResidentPaymentSubmissions(): Promise<PaymentSubmission[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/finance/payment-submissions`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<PaymentSubmission[]>(response)
}

export async function cancelResidentPaymentSubmission(id: number): Promise<PaymentSubmission> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/finance/payment-submissions/${id}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<PaymentSubmission>(response)
}

// Data Import API
export async function uploadImportFile(importType: string, file: File): Promise<ImportUploadResponse> {
  const formData = new FormData()
  formData.append('importType', importType)
  formData.append('file', file)

  const response = await safeFetch(`${API_BASE_URL}/api/imports/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })
  return handleResponse<ImportUploadResponse>(response)
}

export async function getImportColumnOptions(batchId: number): Promise<ImportColumnMappingOptions> {
  const response = await safeFetch(`${API_BASE_URL}/api/imports/${batchId}/columns`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ImportColumnMappingOptions>(response)
}

export async function validateImportBatch(batchId: number, payload: ValidateImportBatchPayload): Promise<ImportPreviewResponse> {
  const response = await safeFetch(`${API_BASE_URL}/api/imports/${batchId}/validate`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ImportPreviewResponse>(response)
}

export async function getImportPreview(batchId: number, action?: string, page = 1, pageSize = 50): Promise<ImportPreviewResponse> {
  const query = new URLSearchParams()
  if (action) query.append('action', action)
  query.append('page', page.toString())
  query.append('pageSize', pageSize.toString())

  const response = await safeFetch(`${API_BASE_URL}/api/imports/${batchId}/preview?${query.toString()}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ImportPreviewResponse>(response)
}

export async function confirmImportBatch(batchId: number): Promise<ImportConfirmResponse> {
  const response = await safeFetch(`${API_BASE_URL}/api/imports/${batchId}/confirm`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<ImportConfirmResponse>(response)
}

export async function getImportSummary(batchId: number): Promise<ImportSummaryResponse> {
  const response = await safeFetch(`${API_BASE_URL}/api/imports/${batchId}/summary`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ImportSummaryResponse>(response)
}

export async function rollbackImportBatch(batchId: number): Promise<ImportRollbackResponse> {
  const response = await safeFetch(`${API_BASE_URL}/api/imports/${batchId}/rollback`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<ImportRollbackResponse>(response)
}

export async function exportImportErrorsCsv(batchId: number): Promise<Blob> {
  const response = await safeFetch(`${API_BASE_URL}/api/imports/${batchId}/export-errors`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Hata raporu indirilemedi.')
  }
  return response.blob()
}

export async function getImportBatches(params?: {
  importType?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<ImportBatchListResponse> {
  const query = new URLSearchParams()
  if (params?.importType) query.append('importType', params.importType)
  if (params?.status) query.append('status', params.status)
  if (params?.page) query.append('page', params.page.toString())
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
  const queryString = query.toString() ? `?${query.toString()}` : ''

  const response = await safeFetch(`${API_BASE_URL}/api/imports${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ImportBatchListResponse>(response)
}

// Announcements Management API
export async function getAnnouncements(params?: {
  propertyId?: number
  buildingId?: number
  status?: string
  priority?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<AnnouncementListResponseDto> {
  const query = new URLSearchParams()
  if (params?.propertyId) query.append('propertyId', params.propertyId.toString())
  if (params?.buildingId) query.append('buildingId', params.buildingId.toString())
  if (params?.status) query.append('status', params.status)
  if (params?.priority) query.append('priority', params.priority)
  if (params?.search) query.append('search', params.search)
  if (params?.page) query.append('page', params.page.toString())
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/announcements${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<AnnouncementListResponseDto>(response)
}

export async function getAnnouncement(id: number): Promise<AnnouncementDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/announcements/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<AnnouncementDto>(response)
}

export async function createAnnouncement(payload: CreateAnnouncementPayload): Promise<AnnouncementDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/announcements`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<AnnouncementDto>(response)
}

export async function updateAnnouncement(id: number, payload: UpdateAnnouncementPayload): Promise<AnnouncementDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/announcements/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<AnnouncementDto>(response)
}

export async function publishAnnouncement(id: number): Promise<AnnouncementDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/announcements/${id}/publish`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<AnnouncementDto>(response)
}

export async function cancelAnnouncement(id: number): Promise<AnnouncementDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/announcements/${id}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<AnnouncementDto>(response)
}

// Maintenance Requests Management API
export async function getMaintenanceRequests(params?: {
  propertyId?: number
  buildingId?: number
  unitId?: number
  status?: string
  priority?: string
  category?: string
  assignedToUserId?: number
  search?: string
  page?: number
  pageSize?: number
}): Promise<MaintenanceRequestListResponseDto> {
  const query = new URLSearchParams()
  if (params?.propertyId) query.append('propertyId', params.propertyId.toString())
  if (params?.buildingId) query.append('buildingId', params.buildingId.toString())
  if (params?.unitId) query.append('unitId', params.unitId.toString())
  if (params?.status) query.append('status', params.status)
  if (params?.priority) query.append('priority', params.priority)
  if (params?.category) query.append('category', params.category)
  if (params?.assignedToUserId) query.append('assignedToUserId', params.assignedToUserId.toString())
  if (params?.search) query.append('search', params.search)
  if (params?.page) query.append('page', params.page.toString())
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/maintenance-requests${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<MaintenanceRequestListResponseDto>(response)
}

export async function getMaintenanceRequest(id: number): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/maintenance-requests/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function assignMaintenanceRequest(id: number, assignedToUserId: number): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/maintenance-requests/${id}/assign`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ assignedToUserId }),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function updateMaintenanceRequestPriority(id: number, priority: string): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/maintenance-requests/${id}/priority`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ priority }),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function updateMaintenanceRequestStatus(id: number, newStatus: string, note?: string): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/maintenance-requests/${id}/status`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ newStatus, note }),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function addMaintenanceRequestNote(id: number, note: string): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/maintenance-requests/${id}/notes`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ note }),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function getMaintenanceRequestAttachmentFile(requestId: number, attachmentId: number): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  const response = await safeFetch(`${API_BASE_URL}/api/maintenance-requests/${requestId}/attachments/${attachmentId}`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    await handleResponse(response)
  }
  const blob = await response.blob()
  const contentType = response.headers.get('Content-Type') || blob.type || 'application/octet-stream'
  const contentDisposition = response.headers.get('Content-Disposition')
  let fileName = `attachment_${attachmentId}`
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;'"\n]+)['"]?/)
    if (match && match[1]) {
      fileName = decodeURIComponent(match[1])
    }
  }
  return { blob, fileName, contentType }
}

// ==========================================
// RESIDENT ANNOUNCEMENTS API
// ==========================================
export async function getResidentAnnouncements(params?: {
  priority?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<AnnouncementListResponseDto> {
  const query = new URLSearchParams()
  if (params?.priority) query.append('priority', params.priority)
  if (params?.search) query.append('search', params.search)
  if (params?.page) query.append('page', params.page.toString())
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/resident/announcements${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<AnnouncementListResponseDto>(response)
}

export async function getResidentAnnouncement(id: number): Promise<AnnouncementDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/announcements/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<AnnouncementDto>(response)
}

// ==========================================
// RESIDENT MAINTENANCE REQUESTS API
// ==========================================
export async function createResidentMaintenanceRequest(payload: {
  category: string
  title: string
  description: string
}): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/maintenance-requests`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function getResidentMaintenanceRequests(params?: {
  status?: string
  category?: string
  page?: number
  pageSize?: number
}): Promise<MaintenanceRequestListResponseDto> {
  const query = new URLSearchParams()
  if (params?.status) query.append('status', params.status)
  if (params?.category) query.append('category', params.category)
  if (params?.page) query.append('page', params.page.toString())
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/resident/maintenance-requests${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<MaintenanceRequestListResponseDto>(response)
}

export async function getResidentMaintenanceRequest(id: number): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/maintenance-requests/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function cancelResidentMaintenanceRequest(id: number): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/maintenance-requests/${id}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function resolveActionResidentMaintenanceRequest(id: number, newStatus: string, note?: string): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/maintenance-requests/${id}/resolve-action`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ newStatus, note }),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function uploadResidentMaintenanceRequestAttachment(id: number, file: File): Promise<MaintenanceRequestAttachmentDto> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await safeFetch(`${API_BASE_URL}/api/resident/maintenance-requests/${id}/attachments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })
  return handleResponse<MaintenanceRequestAttachmentDto>(response)
}

export async function getResidentMaintenanceRequestAttachmentFile(requestId: number, attachmentId: number): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/maintenance-requests/${requestId}/attachments/${attachmentId}`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    await handleResponse(response)
  }
  const blob = await response.blob()
  const contentType = response.headers.get('Content-Type') || blob.type || 'application/octet-stream'
  const contentDisposition = response.headers.get('Content-Disposition')
  let fileName = `attachment_${attachmentId}`
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;'"\n]+)['"]?/)
    if (match && match[1]) {
      fileName = decodeURIComponent(match[1])
    }
  }
  return { blob, fileName, contentType }
}

// ==========================================
// TECHNICAL STAFF MAINTENANCE REQUESTS API
// ==========================================
export async function getTechnicalMaintenanceRequests(params?: {
  status?: string
  priority?: string
  category?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<MaintenanceRequestListResponseDto> {
  const query = new URLSearchParams()
  if (params?.status) query.append('status', params.status)
  if (params?.priority) query.append('priority', params.priority)
  if (params?.category) query.append('category', params.category)
  if (params?.search) query.append('search', params.search)
  if (params?.page) query.append('page', params.page.toString())
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/technical/maintenance-requests${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<MaintenanceRequestListResponseDto>(response)
}

export async function getTechnicalMaintenanceRequest(id: number): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/technical/maintenance-requests/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function updateTechnicalMaintenanceRequestStatus(id: number, newStatus: string, note?: string): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/technical/maintenance-requests/${id}/status`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ newStatus, note }),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function addTechnicalMaintenanceRequestNote(id: number, note: string): Promise<MaintenanceRequestDetailDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/technical/maintenance-requests/${id}/notes`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ note }),
  })
  return handleResponse<MaintenanceRequestDetailDto>(response)
}

export async function getTechnicalMaintenanceRequestAttachmentFile(requestId: number, attachmentId: number): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  const response = await safeFetch(`${API_BASE_URL}/api/technical/maintenance-requests/${requestId}/attachments/${attachmentId}`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    await handleResponse(response)
  }
  const blob = await response.blob()
  const contentType = response.headers.get('Content-Type') || blob.type || 'application/octet-stream'
  const contentDisposition = response.headers.get('Content-Disposition')
  let fileName = `attachment_${attachmentId}`
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;'"\n]+)['"]?/)
    if (match && match[1]) {
      fileName = decodeURIComponent(match[1])
    }
  }
  return { blob, fileName, contentType }
}

export interface BuildingFloorMapDto {
  buildingId: number
  buildingName: string
  buildingCode: string
  propertyId: number
  propertyName: string
  totalFloors: number
  totalUnits: number
  floors: FloorMapFloorDto[]
}

export interface FloorMapFloorDto {
  floorNumber: number
  floorLabel: string
  unitCount: number
  units: FloorMapUnitDto[]
}

export interface FloorMapUnitDto {
  unitId: number
  unitNumber: string
  floorNumber: number
  unitTypeName: string
  isActive: boolean
  occupancyStatus: 'VACANT' | 'OCCUPIED_OWNER' | 'OCCUPIED_TENANT' | string
  primaryResidentName?: string | null
  activeResidentCount: number
  outstandingBalance: number
  hasOverdueDebt: boolean
  openMaintenanceRequestCount: number
  hasEmergencyMaintenanceRequest: boolean
  maintenanceStatus: 'NONE' | 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY' | string
}

export async function getBuildingFloorMap(buildingId: number): Promise<BuildingFloorMapDto> {
  const response = await safeFetch(`${API_BASE_URL}/api/buildings/${buildingId}/floor-map`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<BuildingFloorMapDto>(response)
}

export async function globalSearch(query: string, limit = 5, signal?: AbortSignal): Promise<GlobalSearchResponse> {
  const response = await safeFetch(
    `${API_BASE_URL}/api/global-search?q=${encodeURIComponent(query)}&limit=${limit}`,
    {
      headers: getAuthHeaders(),
      signal,
    }
  )
  return handleResponse<GlobalSearchResponse>(response)
}

// ============================================================================
// Phase 12: Common Area Reservations API
// ============================================================================

export async function getFacilities(params?: {
  propertyId?: number
  buildingId?: number
  isActive?: boolean
}): Promise<CommonFacility[]> {
  const query = new URLSearchParams()
  if (params?.propertyId) query.append('propertyId', params.propertyId.toString())
  if (params?.buildingId) query.append('buildingId', params.buildingId.toString())
  if (params?.isActive !== undefined) query.append('isActive', params.isActive.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/facilities${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<CommonFacility[]>(response)
}

export async function getResidentFacilities(): Promise<CommonFacility[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/facilities`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<CommonFacility[]>(response)
}

export async function getFacility(id: number): Promise<CommonFacility> {
  const response = await safeFetch(`${API_BASE_URL}/api/facilities/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<CommonFacility>(response)
}

export async function createFacility(payload: CreateCommonFacilityPayload): Promise<CommonFacility> {
  const response = await safeFetch(`${API_BASE_URL}/api/facilities`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<CommonFacility>(response)
}

export async function updateFacility(id: number, payload: UpdateCommonFacilityPayload): Promise<CommonFacility> {
  const response = await safeFetch(`${API_BASE_URL}/api/facilities/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<CommonFacility>(response)
}

export async function setFacilityStatus(id: number, isActive: boolean): Promise<CommonFacility> {
  const response = await safeFetch(`${API_BASE_URL}/api/facilities/${id}/status?isActive=${isActive}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  })
  return handleResponse<CommonFacility>(response)
}

export async function getMaintenanceBlocks(facilityId: number): Promise<FacilityMaintenanceBlock[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/facilities/${facilityId}/maintenance-blocks`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<FacilityMaintenanceBlock[]>(response)
}

export async function createMaintenanceBlock(
  facilityId: number,
  payload: CreateMaintenanceBlockPayload
): Promise<FacilityMaintenanceBlock> {
  const response = await safeFetch(`${API_BASE_URL}/api/facilities/${facilityId}/maintenance-blocks`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<FacilityMaintenanceBlock>(response)
}

export async function deleteMaintenanceBlock(blockId: number): Promise<void> {
  const response = await safeFetch(`${API_BASE_URL}/api/facilities/maintenance-blocks/${blockId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    await handleResponse(response)
  }
}

export async function getFacilityAvailability(facilityId: number, date: string): Promise<FacilityAvailability> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/facilities/${facilityId}/availability?date=${date}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<FacilityAvailability>(response)
}

export async function createFacilityReservation(payload: CreateReservationPayload): Promise<FacilityReservation> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/facility-reservations`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<FacilityReservation>(response)
}

export async function cancelFacilityReservation(id: number): Promise<FacilityReservation> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/facility-reservations/${id}/cancel`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  })
  return handleResponse<FacilityReservation>(response)
}

export async function getMyFacilityReservations(): Promise<FacilityReservation[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/facility-reservations/my`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<FacilityReservation[]>(response)
}

export async function getManagementFacilityReservations(params?: {
  facilityId?: number
  propertyId?: number
  buildingId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
}): Promise<FacilityReservation[]> {
  const query = new URLSearchParams()
  if (params?.facilityId) query.append('facilityId', params.facilityId.toString())
  if (params?.propertyId) query.append('propertyId', params.propertyId.toString())
  if (params?.buildingId) query.append('buildingId', params.buildingId.toString())
  if (params?.status) query.append('status', params.status)
  if (params?.dateFrom) query.append('dateFrom', params.dateFrom)
  if (params?.dateTo) query.append('dateTo', params.dateTo)

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/management/facility-reservations${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<FacilityReservation[]>(response)
}

export async function approveFacilityReservation(id: number): Promise<FacilityReservation> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/facility-reservations/${id}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<FacilityReservation>(response)
}

export async function rejectFacilityReservation(
  id: number,
  payload?: ReviewReservationPayload
): Promise<FacilityReservation> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/facility-reservations/${id}/reject`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload || {}),
  })
  return handleResponse<FacilityReservation>(response)
}

// ============================================================================
// Phase 12: Visitor & Vehicle Management API
// ============================================================================

export async function getResidentVisitors(params?: {
  status?: string
  upcomingOnly?: boolean
}): Promise<Visitor[]> {
  const query = new URLSearchParams()
  if (params?.status) query.append('status', params.status)
  if (params?.upcomingOnly !== undefined) query.append('upcomingOnly', params.upcomingOnly.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/resident/visitors${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Visitor[]>(response)
}

export async function getResidentVisitor(id: number): Promise<Visitor> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/visitors/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Visitor>(response)
}

export async function createVisitor(payload: CreateVisitorPayload): Promise<Visitor> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/visitors`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Visitor>(response)
}

export async function cancelVisitor(id: number): Promise<Visitor> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/visitors/${id}/cancel`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  })
  return handleResponse<Visitor>(response)
}

export async function getManagementVisitors(params?: {
  propertyId?: number
  buildingId?: number
  unitId?: number
  status?: string
  search?: string
  vehiclePlate?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}): Promise<PagedVisitorResult> {
  const query = new URLSearchParams()
  if (params?.propertyId) query.append('propertyId', params.propertyId.toString())
  if (params?.buildingId) query.append('buildingId', params.buildingId.toString())
  if (params?.unitId) query.append('unitId', params.unitId.toString())
  if (params?.status) query.append('status', params.status)
  if (params?.search) query.append('search', params.search)
  if (params?.vehiclePlate) query.append('vehiclePlate', params.vehiclePlate)
  if (params?.dateFrom) query.append('dateFrom', params.dateFrom)
  if (params?.dateTo) query.append('dateTo', params.dateTo)
  if (params?.page) query.append('page', params.page.toString())
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/management/visitors${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<PagedVisitorResult>(response)
}

export async function getManagementVisitor(id: number): Promise<Visitor> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/visitors/${id}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Visitor>(response)
}

export async function checkInVisitor(id: number): Promise<Visitor> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/visitors/${id}/check-in`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<Visitor>(response)
}

export async function checkOutVisitor(id: number): Promise<Visitor> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/visitors/${id}/check-out`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse<Visitor>(response)
}

export async function getResidentVehicles(): Promise<ResidentVehicle[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/vehicles`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<ResidentVehicle[]>(response)
}

export async function createResidentVehicle(payload: CreateResidentVehiclePayload): Promise<ResidentVehicle> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/vehicles`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ResidentVehicle>(response)
}

export async function updateResidentVehicle(id: number, payload: UpdateResidentVehiclePayload): Promise<ResidentVehicle> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/vehicles/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<ResidentVehicle>(response)
}

export async function setResidentVehicleStatus(id: number, isActive: boolean): Promise<ResidentVehicle> {
  const response = await safeFetch(`${API_BASE_URL}/api/resident/vehicles/${id}/status?isActive=${isActive}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  })
  return handleResponse<ResidentVehicle>(response)
}

export async function getManagementVehicles(params?: {
  propertyId?: number
  buildingId?: number
  unitId?: number
  plateNumber?: string
  vehicleType?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}): Promise<PagedResidentVehicleResult> {
  const query = new URLSearchParams()
  if (params?.propertyId) query.append('propertyId', params.propertyId.toString())
  if (params?.buildingId) query.append('buildingId', params.buildingId.toString())
  if (params?.unitId) query.append('unitId', params.unitId.toString())
  if (params?.plateNumber) query.append('plateNumber', params.plateNumber)
  if (params?.vehicleType) query.append('vehicleType', params.vehicleType)
  if (params?.isActive !== undefined) query.append('isActive', params.isActive.toString())
  if (params?.page) query.append('page', params.page.toString())
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ''
  const response = await safeFetch(`${API_BASE_URL}/api/management/vehicles${queryString}`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<PagedResidentVehicleResult>(response)
}
