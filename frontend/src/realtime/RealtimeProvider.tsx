import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { RealtimeContext } from './RealtimeContext'
import type { ActivityFeedInvalidatedEvent, MaintenanceRequestUpdatedEvent, NotificationCreatedEvent, RealtimeConnectionState, UserScopeInvalidatedEvent } from './types'

interface RealtimeProviderProps {
  user: any
  children: ReactNode
}

export function RealtimeProvider({ user, children }: RealtimeProviderProps) {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('disconnected')
  const connectionRef = useRef<HubConnection | null>(null)
  const isStartingRef = useRef<boolean>(false)

  // Event handlers stores
  const notificationHandlersRef = useRef<Set<(evt: NotificationCreatedEvent) => void>>(new Set())
  const scopeInvalidatedHandlersRef = useRef<Set<(evt: UserScopeInvalidatedEvent) => void>>(new Set())
  const maintenanceHandlersRef = useRef<Set<(evt: MaintenanceRequestUpdatedEvent) => void>>(new Set())
  const activityFeedHandlersRef = useRef<Set<(evt: ActivityFeedInvalidatedEvent) => void>>(new Set())
  const reconnectedHandlersRef = useRef<Set<() => void>>(new Set())

  useEffect(() => {
    if (!user) {
      if (connectionRef.current) {
        void connectionRef.current.stop()
        connectionRef.current = null;
        setConnectionState('disconnected')
      }
      return
    }

    const token = localStorage.getItem('rms_access_token')
    if (!token) return

    // If connection already exists and active, do not recreate
    if (connectionRef.current && connectionRef.current.state !== HubConnectionState.Disconnected) {
      return
    }

    if (isStartingRef.current) return
    isStartingRef.current = true

    const conn = new HubConnectionBuilder()
      .withUrl('/hubs/realtime', {
        accessTokenFactory: () => localStorage.getItem('rms_access_token') || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build()

    conn.onreconnecting(() => {
      setConnectionState('reconnecting')
    })

    conn.onreconnected(() => {
      setConnectionState('connected')
      reconnectedHandlersRef.current.forEach((handler) => {
        try {
          handler()
        } catch (err) {
          console.error('Error in onReconnected handler:', err)
        }
      })
    })

    conn.onclose(() => {
      setConnectionState('disconnected')
    })

    // Hub Event Listeners
    conn.on('NotificationCreated', (evt: NotificationCreatedEvent) => {
      notificationHandlersRef.current.forEach((handler) => {
        try {
          handler(evt)
        } catch (err) {
          console.error('Error handling NotificationCreated event:', err)
        }
      })
    })

    conn.on('UserScopeInvalidated', (evt: UserScopeInvalidatedEvent) => {
      scopeInvalidatedHandlersRef.current.forEach((handler) => {
        try {
          handler(evt)
        } catch (err) {
          console.error('Error handling UserScopeInvalidated event:', err)
        }
      })
      // Perform automatic reconnection on scope invalidation to recompute hub groups
      if (conn.state === HubConnectionState.Connected) {
        void conn.stop().then(() => conn.start())
      }
    })

    conn.on('MaintenanceRequestUpdated', (evt: MaintenanceRequestUpdatedEvent) => {
      maintenanceHandlersRef.current.forEach((handler) => {
        try {
          handler(evt)
        } catch (err) {
          console.error('Error handling MaintenanceRequestUpdated event:', err)
        }
      })
    })

    conn.on('ActivityFeedInvalidated', (evt: ActivityFeedInvalidatedEvent) => {
      activityFeedHandlersRef.current.forEach((handler) => {
        try {
          handler(evt)
        } catch (err) {
          console.error('Error handling ActivityFeedInvalidated event:', err)
        }
      })
    })

    connectionRef.current = conn
    setConnectionState('connecting')

    conn
      .start()
      .then(() => {
        setConnectionState('connected')
      })
      .catch((err) => {
        console.warn('SignalR Connection start error:', err)
        setConnectionState('disconnected')
      })
      .finally(() => {
        isStartingRef.current = false
      })

    return () => {
      isStartingRef.current = false
      if (connectionRef.current) {
        void connectionRef.current.stop()
        connectionRef.current = null
        setConnectionState('disconnected')
      }
    }
  }, [user])

  const onNotificationCreated = useCallback((handler: (evt: NotificationCreatedEvent) => void) => {
    notificationHandlersRef.current.add(handler)
    return () => {
      notificationHandlersRef.current.delete(handler)
    }
  }, [])

  const onUserScopeInvalidated = useCallback((handler: (evt: UserScopeInvalidatedEvent) => void) => {
    scopeInvalidatedHandlersRef.current.add(handler)
    return () => {
      scopeInvalidatedHandlersRef.current.delete(handler)
    }
  }, [])

  const onMaintenanceRequestUpdated = useCallback((handler: (evt: MaintenanceRequestUpdatedEvent) => void) => {
    maintenanceHandlersRef.current.add(handler)
    return () => {
      maintenanceHandlersRef.current.delete(handler)
    }
  }, [])

  const onActivityFeedInvalidated = useCallback((handler: (evt: ActivityFeedInvalidatedEvent) => void) => {
    activityFeedHandlersRef.current.add(handler)
    return () => {
      activityFeedHandlersRef.current.delete(handler)
    }
  }, [])

  const onReconnected = useCallback((handler: () => void) => {
    reconnectedHandlersRef.current.add(handler)
    return () => {
      reconnectedHandlersRef.current.delete(handler)
    }
  }, [])

  const reconnect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        if (connectionRef.current.state === HubConnectionState.Connected) {
          await connectionRef.current.stop()
        }
        await connectionRef.current.start()
        setConnectionState('connected')
      } catch (err) {
        console.error('Failed to reconnect SignalR:', err)
        setConnectionState('disconnected')
      }
    }
  }, [])

  return (
    <RealtimeContext.Provider
      value={{
        connection: connectionRef.current,
        connectionState,
        onNotificationCreated,
        onUserScopeInvalidated,
        onMaintenanceRequestUpdated,
        onActivityFeedInvalidated,
        onReconnected,
        reconnect,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  )
}
