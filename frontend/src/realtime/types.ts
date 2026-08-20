import type { NotificationDto } from '../types'

export interface NotificationCreatedEvent {
  notification: NotificationDto
}

export interface UserScopeInvalidatedEvent {
  userId: number
  reason: string
}

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
