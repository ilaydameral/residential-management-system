import { createContext } from 'react'
import type { HubConnection } from '@microsoft/signalr'
import type { ActivityFeedInvalidatedEvent, FacilityAvailabilityInvalidatedEvent, FacilityReservationUpdatedEvent, MaintenanceRequestUpdatedEvent, NotificationCreatedEvent, RealtimeConnectionState, UserScopeInvalidatedEvent, VisitorStatusChangedEvent } from './types'

export interface RealtimeContextType {
  connection: HubConnection | null
  connectionState: RealtimeConnectionState
  onNotificationCreated: (handler: (evt: NotificationCreatedEvent) => void) => () => void
  onUserScopeInvalidated: (handler: (evt: UserScopeInvalidatedEvent) => void) => () => void
  onMaintenanceRequestUpdated: (handler: (evt: MaintenanceRequestUpdatedEvent) => void) => () => void
  onActivityFeedInvalidated: (handler: (evt: ActivityFeedInvalidatedEvent) => void) => () => void
  onFacilityReservationUpdated: (handler: (evt: FacilityReservationUpdatedEvent) => void) => () => void
  onFacilityAvailabilityInvalidated: (handler: (evt: FacilityAvailabilityInvalidatedEvent) => void) => () => void
  onVisitorStatusChanged: (handler: (evt: VisitorStatusChangedEvent) => void) => () => void
  onReconnected: (handler: () => void) => () => void
  reconnect: () => Promise<void>
}

export const RealtimeContext = createContext<RealtimeContextType | null>(null)
