import { useContext } from 'react'
import { RealtimeContext, type RealtimeContextType } from './RealtimeContext'

export function useRealtime(): RealtimeContextType {
  const ctx = useContext(RealtimeContext)
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return ctx
}
