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

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
