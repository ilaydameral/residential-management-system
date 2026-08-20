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

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
