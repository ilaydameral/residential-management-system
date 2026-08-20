import { createContext } from 'react'
import type { HubConnection } from '@microsoft/signalr'
import type { NotificationCreatedEvent, RealtimeConnectionState, UserScopeInvalidatedEvent } from './types'

export interface RealtimeContextType {
  connection: HubConnection | null
  connectionState: RealtimeConnectionState
  onNotificationCreated: (handler: (evt: NotificationCreatedEvent) => void) => () => void
  onUserScopeInvalidated: (handler: (evt: UserScopeInvalidatedEvent) => void) => () => void
  onReconnected: (handler: () => void) => () => void
  reconnect: () => Promise<void>
}

export const RealtimeContext = createContext<RealtimeContextType | null>(null)
