import type { NotificationDto } from '../types'

export interface NotificationCreatedEvent {
  notification: NotificationDto
}

export interface UserScopeInvalidatedEvent {
  userId: number
  reason: string
}

export interface MaintenanceRequestUpdatedEvent {
  requestId: number
  propertyId: number
  buildingId: number
  eventType: string
  updatedAt: string
  oldStatus?: string
  newStatus?: string
  assignedToUserId?: number
  oldAssignedToUserId?: number
  updatedByUserId: number
}

export interface ActivityFeedInvalidatedEvent {
  category: string
  occurredAt: string
}

export interface ActivityFeedItemDto {
  id: string
  category: 'MAINTENANCE' | 'ANNOUNCEMENT' | 'FINANCE' | 'OCCUPANCY' | 'MANAGEMENT'
  activityType: string
  title: string
  description: string
  actorName: string
  occurredAt: string
  propertyId?: number
  buildingId?: number
  unitId?: number
  relatedEntityId?: number
  targetView?: string
  routeParams?: string
}

export interface PagedActivityFeedDto {
  items: ActivityFeedItemDto[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPreviousPage?: boolean
  hasNextPage?: boolean
}

export interface VisitorStatusChangedEvent {
  visitorId: number
  unitId: number
  status: string
  updatedAt: string
}

export interface FacilityReservationUpdatedEvent {
  reservationId: number
  facilityId: number
  status: string
  updatedAt: string
}

export interface FacilityAvailabilityInvalidatedEvent {
  facilityId: number
  date: string
}

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
