import { API_BASE_URL } from './config'
import type {
  ApiErrorResponse,
  AuthenticatedUser,
  Building,
  CreateBuildingPayload,
  CreatePropertyPayload,
  CreateUnitPayload,
  LoginRequest,
  LoginResponse,
  Property,
  PropertyType,
  RegisterRequest,
  Unit,
  UnitType,
  UpdateBuildingPayload,
  UpdatePropertyPayload,
  UpdateUnitPayload,
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

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    if (unauthorizedHandler) {
      unauthorizedHandler()
    }
    let errorText = 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.'
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
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
  return handleResponse<LoginResponse>(response)
}

export async function registerApi(payload: RegisterRequest): Promise<AuthenticatedUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<AuthenticatedUser>(response)
}


// Property Types API
export async function getPropertyTypes(includeInactive = false): Promise<PropertyType[]> {
  const url = `${API_BASE_URL}/api/property-types${includeInactive ? '?includeInactive=true' : ''}`
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<PropertyType[]>(response)
}

// Unit Types API
export async function getUnitTypes(includeInactive = false): Promise<UnitType[]> {
  const url = `${API_BASE_URL}/api/unit-types${includeInactive ? '?includeInactive=true' : ''}`
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<UnitType[]>(response)
}

// Properties API
export async function getProperties(includeInactive = true): Promise<Property[]> {
  const url = `${API_BASE_URL}/api/properties${includeInactive ? '?includeInactive=true' : ''}`
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Property[]>(response)
}

export async function createProperty(payload: CreatePropertyPayload): Promise<Property> {
  const response = await fetch(`${API_BASE_URL}/api/properties`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Property>(response)
}

export async function updateProperty(id: number, payload: UpdatePropertyPayload): Promise<Property> {
  const response = await fetch(`${API_BASE_URL}/api/properties/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Property>(response)
}

export async function deactivateProperty(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/properties/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  await handleResponse<void>(response)
}

// Buildings API
export async function getBuildingsByProperty(propertyId: number, includeInactive = true): Promise<Building[]> {
  const url = `${API_BASE_URL}/api/buildings/property/${propertyId}${includeInactive ? '?includeInactive=true' : ''}`
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Building[]>(response)
}

export async function createBuilding(payload: CreateBuildingPayload): Promise<Building> {
  const response = await fetch(`${API_BASE_URL}/api/buildings`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Building>(response)
}

export async function updateBuilding(id: number, payload: UpdateBuildingPayload): Promise<Building> {
  const response = await fetch(`${API_BASE_URL}/api/buildings/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Building>(response)
}

export async function deleteBuilding(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/buildings/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  await handleResponse<void>(response)
}

// Units API
export async function getUnitsByBuilding(buildingId: number, includeInactive = true): Promise<Unit[]> {
  const url = `${API_BASE_URL}/api/units/building/${buildingId}${includeInactive ? '?includeInactive=true' : ''}`
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Unit[]>(response)
}

export async function createUnit(payload: CreateUnitPayload): Promise<Unit> {
  const response = await fetch(`${API_BASE_URL}/api/units`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Unit>(response)
}

export async function updateUnit(id: number, payload: UpdateUnitPayload): Promise<Unit> {
  const response = await fetch(`${API_BASE_URL}/api/units/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return handleResponse<Unit>(response)
}

export async function deleteUnit(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/units/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  await handleResponse<void>(response)
}
