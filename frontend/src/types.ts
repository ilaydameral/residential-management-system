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
  createdAt: string
  updatedAt: string | null
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

export interface ApiErrorResponse {
  statusCode?: number
  message?: string
  details?: string | null
  errors?: Record<string, string[]>
}
