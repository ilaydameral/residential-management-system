import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate, type NavigateOptions } from 'react-router-dom'

interface RouteChangeGuardOptions {
  isDirty: boolean
  requestDiscard: (hasChanges?: boolean) => Promise<boolean>
  onApprovedRouteChange: () => void
}

export function useRouteChangeGuard({
  isDirty,
  requestDiscard,
  onApprovedRouteChange,
}: RouteChangeGuardOptions) {
  const location = useLocation()
  const navigate = useNavigate()
  const currentHistoryIndexRef = useRef<number>(window.history.state?.idx ?? 0)
  const isRestoringHistoryRef = useRef(false)
  const isApprovedHistoryMoveRef = useRef(false)
  const pendingHistoryDeltaRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isRestoringHistoryRef.current && !isApprovedHistoryMoveRef.current) {
      currentHistoryIndexRef.current = window.history.state?.idx ?? currentHistoryIndexRef.current
    }
  }, [location.key])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const targetIndex = event.state?.idx
      if (typeof targetIndex !== 'number') return

      if (isApprovedHistoryMoveRef.current) {
        isApprovedHistoryMoveRef.current = false
        currentHistoryIndexRef.current = targetIndex
        return
      }

      if (isRestoringHistoryRef.current) {
        isRestoringHistoryRef.current = false
        currentHistoryIndexRef.current = targetIndex
        const pendingDelta = pendingHistoryDeltaRef.current
        pendingHistoryDeltaRef.current = null

        if (pendingDelta == null) return

        void requestDiscard(true).then((shouldDiscard) => {
          if (!shouldDiscard) return
          onApprovedRouteChange()
          isApprovedHistoryMoveRef.current = true
          window.history.go(pendingDelta)
        })
        return
      }

      const delta = targetIndex - currentHistoryIndexRef.current
      if (delta === 0) return

      if (!isDirty) {
        currentHistoryIndexRef.current = targetIndex
        onApprovedRouteChange()
        return
      }

      pendingHistoryDeltaRef.current = delta
      isRestoringHistoryRef.current = true
      window.history.go(-delta)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isDirty, onApprovedRouteChange, requestDiscard])

  const navigateWithGuard = useCallback(
    async (to: string, options?: NavigateOptions) => {
      const currentUrl = `${location.pathname}${location.search}`
      if (to === currentUrl) return true
      if (!(await requestDiscard())) return false

      onApprovedRouteChange()
      navigate(to, options)
      return true
    },
    [location.pathname, location.search, navigate, onApprovedRouteChange, requestDiscard]
  )

  return { navigateWithGuard }
}
