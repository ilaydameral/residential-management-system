export interface PropertyType {
  id: number
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export interface UnitType {
  id: number
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export interface Property {
  id: number
  name: string
  propertyTypeId?: number | null
  propertyType: string
  propertyTypeName?: string | null
  addressLine: string
  city: string
  district: string
  description: string | null
  isActive: boolean
  buildingCount: number
  unitCount: number
  createdAt: string
}

export interface CreatePropertyPayload {
  name: string
  propertyTypeId?: number | null
  propertyType?: string | null
  addressLine: string
  city: string
  district: string
  description?: string | null
}

export interface UpdatePropertyPayload {
  name: string
  propertyTypeId?: number | null
  propertyType?: string | null
  addressLine: string
  city: string
  district: string
  description?: string | null
  isActive: boolean
}

export interface Building {
  id: number
  propertyId: number
  propertyName: string
  name: string
  code: string
  floorCount: number
  description: string | null
  isActive: boolean
  unitCount: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateBuildingPayload {
  propertyId: number
  name: string
  code: string
  floorCount: number
  description?: string | null
}

export interface UpdateBuildingPayload {
  propertyId: number
  name: string
  code: string
  floorCount: number
  description?: string | null
  isActive: boolean
}

export interface Unit {
  id: number
  buildingId: number
  buildingName: string
  propertyId: number
  propertyName: string
  unitTypeId: number
  unitTypeName: string
  unitTypeCode: string
  unitNumber: string
  floorNumber: number
  grossArea: number | null
  netArea: number | null
  description: string | null
  isActive: boolean
  activeOccupancyCount: number
  createdAt: string
  updatedAt: string | null
}

export interface ResidentUnit {
  unitId: number
  propertyName: string
  buildingName: string
  unitNumber: string
  floorNumber: number
  unitTypeName: string
  grossArea: number | null
  netArea: number | null
  occupancyType: OccupancyTypeCode
  isPrimary: boolean
  startDate: string
}

export interface AccountProfile {
  id: number
  fullName: string
  userName?: string | null
  email: string
  roles: string[]
  isActive: boolean
  createdAt: string
}

export interface UpdateAccountProfilePayload {
  fullName: string
}

export interface ChangeAccountPasswordPayload {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

export interface CreateUnitPayload {
  buildingId: number
  unitTypeId: number
  unitNumber: string
  floorNumber: number
  grossArea?: number | null
  netArea?: number | null
  description?: string | null
}

export interface UpdateUnitPayload {
  buildingId: number
  unitTypeId: number
  unitNumber: string
  floorNumber: number
  grossArea?: number | null
  netArea?: number | null
  description?: string | null
  isActive: boolean
}

export type OccupancyTypeCode = 'OWNER' | 'TENANT' | 'HOUSEHOLD_MEMBER'

export interface OccupancyType {
  id: number
  code: OccupancyTypeCode
  name: string
}

export interface UnitOccupancy {
  id: number
  userId: number
  userName: string
  userFullName: string
  userEmail: string
  unitId: number
  unitNumber: string
  buildingId: number
  buildingName: string
  propertyId: number
  propertyName: string
  occupancyTypeId: number
  occupancyTypeCode: OccupancyTypeCode
  occupancyTypeName: string
  startDate: string
  endDate: string | null
  isActive: boolean
  isPrimary: boolean
  notes: string | null
  createdAt: string
  updatedAt: string | null
}

export interface UserSearchResult {
  id: number
  fullName: string
  email: string
  isActive: boolean
}

export interface ManagedUser {
  id: number
  fullName: string
  email: string
  roles: string[]
  isActive: boolean
  activeUnitCount: number
  createdAt: string
}

export interface ManagedUserDetail {
  id: number
  firstName: string
  lastName: string
  email: string
  roles: string[]
  isActive: boolean
}

export interface Role {
  id: number
  code: string
  name: string
  isActive: boolean
}

export interface CreateManagedUserPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  roleCodes: string[]
  isActive: boolean
}

export interface UpdateManagedUserPayload {
  firstName: string
  lastName: string
  email: string
}

export interface UpdateUserRolesPayload {
  roleCodes: string[]
}

export interface CreateUnitOccupancyPayload {
  userId: number
  occupancyTypeId: number
  startDate: string
  endDate: string | null
  isPrimary: boolean
  notes: string | null
}

export interface UpdateUnitOccupancyPayload {
  occupancyTypeId: number
  startDate: string
  endDate: string | null
  isPrimary: boolean
  notes: string | null
}

export interface EndUnitOccupancyPayload {
  endDate: string
}

export interface LoginRequest {
  userNameOrEmail: string
  password: string
}

export interface RegisterRequest {
  userName: string
  email: string
  password: string
  firstName: string
  lastName: string
}


export interface AuthenticatedUser {
  id: number
  userName: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
}

export interface LoginResponse {
  accessToken: string
  expiresAtUtc: string
  user: AuthenticatedUser
}

export interface ApiErrorResponse {
  statusCode?: number
  message?: string
  details?: string | null
  errors?: Record<string, string[]>
}

export interface DashboardSummary {
  propertyCount: number
  buildingCount: number
  unitCount: number
  activeOccupancyCount: number
  occupiedUnitCount: number
  vacantUnitCount: number
}
