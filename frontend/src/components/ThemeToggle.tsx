import { useState, type TransitionEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTheme, type Theme } from '../context/ThemeContext'

type CurtainPhase = 'idle' | 'falling' | 'rising'

function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [phase, setPhase] = useState<CurtainPhase>('idle')
  const [targetTheme, setTargetTheme] = useState<Theme>(theme)

  const toggleTheme = () => {
    if (phase !== 'idle') return
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light'
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setTheme(nextTheme)
      return
    }

    setTargetTheme(nextTheme)
    setPhase('falling')
  }

  const handleCurtainTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform' || event.target !== event.currentTarget) return
    if (phase === 'falling') {
      setTheme(targetTheme)
      setPhase('rising')
    } else if (phase === 'rising') {
      setPhase('idle')
    }
  }

  return (
    <>
      {createPortal(
        <>
          <div
            className={`theme-curtain ${phase} to-${targetTheme}`}
            aria-hidden="true"
            onTransitionEnd={handleCurtainTransitionEnd}
          />
          <div className={`theme-curtain-icon ${phase} to-${targetTheme}`} aria-hidden="true">
            {targetTheme === 'dark' ? <MoonIcon /> : <SunIcon />}
          </div>
        </>,
        document.body,
      )}
      <button
        className="theme-toggle-button"
        type="button"
        aria-label={theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
        aria-pressed={theme === 'dark'}
        disabled={phase !== 'idle'}
        onClick={toggleTheme}
      >
        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
      </button>
    </>
  )
}
