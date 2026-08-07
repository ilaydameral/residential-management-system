import { API_BASE_URL } from './config'
import type {
  ApiErrorResponse,
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
export async function getUsers(): Promise<ManagedUser[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/users`, {
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

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const params = new URLSearchParams({ query: query.trim() })
  const response = await safeFetch(`${API_BASE_URL}/api/users/search?${params.toString()}`, {
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

export async function getPaymentSubmissionReceiptFile(id: number): Promise<{ blob: Blob; fileName: string }> {
  const response = await safeFetch(`${API_BASE_URL}/api/management/payment-submissions/${id}/receipt`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    await handleResponse(response)
  }
  const blob = await response.blob()
  const contentDisposition = response.headers.get('Content-Disposition')
  let fileName = `receipt_${id}.pdf`
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;'"\n]+)['"]?/)
    if (match && match[1]) {
      fileName = decodeURIComponent(match[1])
    }
  }
  return { blob, fileName }
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
