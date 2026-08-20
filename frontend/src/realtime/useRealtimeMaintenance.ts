import { useEffect } from 'react'
import { useRealtime } from './useRealtime'
import type { MaintenanceRequestUpdatedEvent } from './types'

export function useRealtimeMaintenance(
  onUpdated?: (evt: MaintenanceRequestUpdatedEvent) => void,
  onReconnected?: () => void
) {
  const { onMaintenanceRequestUpdated, onReconnected: subscribeReconnected, connectionState } = useRealtime()

  useEffect(() => {
    if (!onUpdated) return
    const unsubscribe = onMaintenanceRequestUpdated(onUpdated)
    return () => {
      unsubscribe()
    }
  }, [onMaintenanceRequestUpdated, onUpdated])

  useEffect(() => {
    if (!onReconnected) return
    const unsubscribe = subscribeReconnected(onReconnected)
    return () => {
      unsubscribe()
    }
  }, [subscribeReconnected, onReconnected])

  return { connectionState }
}
