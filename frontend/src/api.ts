import { API_BASE_URL } from './config'
import type {
  ApiErrorResponse,
  AccountProfile,
  AuthenticatedUser,
  Building,
  CreateBuildingPayload,
  CreateManagedUserPayload,
  CreatePropertyPayload,
  CreateUnitOccupancyPayload,
  CreateUnitPayload,
  DashboardSummary,
  EndUnitOccupancyPayload,
  LoginRequest,
  LoginResponse,
  ManagedUser,
  ManagedUserDetail,
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
