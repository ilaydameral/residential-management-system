import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { MoonIcon, SunIcon } from '../components/ThemeIcons'

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

const THEME_STORAGE_KEY = 'rms_theme'
type CurtainPhase = 'idle' | 'falling' | 'rising'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: Theme
  isThemeTransitioning: boolean
  setThemePreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getInitialPreference(): ThemePreference {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      return storedTheme
    }
  } catch {
    // Depolama kullanılamıyorsa sistem tercihi kullanılır.
  }
  return 'system'
}

function getInitialResolvedTheme(): Theme {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark'
  }
  return 'light'
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== 'system') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference)
  const [resolvedTheme, setResolvedTheme] = useState<Theme>(getInitialResolvedTheme)
  const [curtainPhase, setCurtainPhase] = useState<CurtainPhase>('idle')
  const [curtainTargetTheme, setCurtainTargetTheme] = useState<Theme>(getInitialResolvedTheme)
  const transitionLockRef = useRef(false)
  const pendingPreferenceRef = useRef<ThemePreference | null>(null)

  const commitPreference = useCallback((nextPreference: ThemePreference, nextTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
    } catch {
      // Tema, depolama kullanılamasa da mevcut oturumda uygulanmaya devam eder.
    }
    applyTheme(nextTheme)
    setPreferenceState(nextPreference)
    setResolvedTheme(nextTheme)
  }, [])

  const setThemePreference = useCallback((nextPreference: ThemePreference) => {
    if (transitionLockRef.current || nextPreference === preference) return

    const nextTheme = resolveTheme(nextPreference)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (nextTheme === resolvedTheme || reduceMotion) {
      commitPreference(nextPreference, nextTheme)
      return
    }

    transitionLockRef.current = true
    pendingPreferenceRef.current = nextPreference
    setCurtainTargetTheme(nextTheme)
    setCurtainPhase('falling')
  }, [commitPreference, preference, resolvedTheme])

  const handleCurtainTransitionEnd = useCallback((event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform' || event.target !== event.currentTarget) return

    if (curtainPhase === 'falling') {
      const nextPreference = pendingPreferenceRef.current
      if (nextPreference) {
        commitPreference(nextPreference, resolveTheme(nextPreference))
      }
      setCurtainPhase('rising')
      return
    }

    if (curtainPhase === 'rising') {
      if (pendingPreferenceRef.current === 'system') {
        const currentSystemTheme = resolveTheme('system')
        applyTheme(currentSystemTheme)
        setResolvedTheme(currentSystemTheme)
      }
      pendingPreferenceRef.current = null
      transitionLockRef.current = false
      setCurtainPhase('idle')
    }
  }, [commitPreference, curtainPhase])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncResolvedTheme = () => {
      if (transitionLockRef.current) return
      const nextTheme = preference === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : preference
      applyTheme(nextTheme)
      setResolvedTheme(nextTheme)
    }
    syncResolvedTheme()
    mediaQuery.addEventListener('change', syncResolvedTheme)
    return () => mediaQuery.removeEventListener('change', syncResolvedTheme)
  }, [preference])

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      isThemeTransitioning: curtainPhase !== 'idle',
      setThemePreference,
    }),
    [curtainPhase, preference, resolvedTheme, setThemePreference],
  )
  return (
    <ThemeContext.Provider value={value}>
      {children}
      {createPortal(
        <>
          <div
            className={`theme-curtain ${curtainPhase} to-${curtainTargetTheme}`}
            aria-hidden="true"
            onTransitionEnd={handleCurtainTransitionEnd}
          />
          <div className={`theme-curtain-icon ${curtainPhase} to-${curtainTargetTheme}`} aria-hidden="true">
            {curtainTargetTheme === 'dark' ? <MoonIcon /> : <SunIcon />}
          </div>
        </>,
        document.body,
      )}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
