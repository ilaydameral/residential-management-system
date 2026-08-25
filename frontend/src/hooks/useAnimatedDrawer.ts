import { useCallback, useEffect, useRef, useState } from 'react'

export type DrawerAnimationPhase = 'closed' | 'opening' | 'open' | 'closing'

const DRAWER_EXIT_DURATION_MS = 250

export function useAnimatedDrawer(isOpen: boolean) {
  const [phase, setPhase] = useState<DrawerAnimationPhase>('closed')
  const phaseRef = useRef<DrawerAnimationPhase>('closed')
  const timerRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  const updatePhase = useCallback((nextPhase: DrawerAnimationPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (phaseRef.current === 'open' || phaseRef.current === 'opening') return

    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    updatePhase('opening')
    frameRef.current = window.requestAnimationFrame(() => updatePhase('open'))
  }, [isOpen, updatePhase])

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  const close = useCallback((onClosed: () => void) => {
    if (phaseRef.current === 'closed' || phaseRef.current === 'closing') return
    if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current)
    updatePhase('closing')

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      updatePhase('closed')
      onClosed()
    }, reduceMotion ? 0 : DRAWER_EXIT_DURATION_MS)
  }, [updatePhase])

  useEffect(() => {
    if (!isOpen && phaseRef.current !== 'closed' && phaseRef.current !== 'closing') {
      close(() => undefined)
    }
  }, [close, isOpen])

  return {
    phase,
    shouldRender: phase !== 'closed',
    isClosing: phase === 'closing',
    close,
  }
}
