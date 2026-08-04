import { useLocation, useNavigate } from 'react-router-dom'

interface HeaderSettingsButtonProps {
  onActivate?: () => void
}

export function HeaderSettingsButton({ onActivate }: HeaderSettingsButtonProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = location.pathname === '/settings'

  return (
    <button
      className={`theme-toggle-button header-settings-button ${isActive ? 'active' : ''}`}
      type="button"
      aria-label="Ayarlar"
      aria-current={isActive ? 'page' : undefined}
      title="Ayarlar"
      onClick={onActivate ?? (() => navigate('/settings'))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </svg>
    </button>
  )
}
