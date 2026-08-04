import { useTheme, type Theme } from '../context/ThemeContext'
import { MoonIcon, SunIcon } from './ThemeIcons'

export function ThemeToggle() {
  const { preference, resolvedTheme, isThemeTransitioning, setThemePreference } = useTheme()

  const toggleTheme = () => {
    const nextTheme: Theme = resolvedTheme === 'light' ? 'dark' : 'light'
    setThemePreference(nextTheme)
  }

  return (
    <button
      className="theme-toggle-button"
      type="button"
      aria-label={resolvedTheme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
      aria-pressed={resolvedTheme === 'dark'}
      title={`${preference === 'system' ? 'Sistem teması etkin. ' : ''}${resolvedTheme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}`}
      disabled={isThemeTransitioning}
      onClick={toggleTheme}
    >
      {resolvedTheme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}
