import { useLocation, useNavigate } from 'react-router-dom'

interface HeaderAccountButtonProps {
  onActivate?: () => void
}

export function HeaderAccountButton({ onActivate }: HeaderAccountButtonProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = location.pathname === '/account' || location.pathname === '/resident/account'

  return (
    <button
      className={`theme-toggle-button header-account-button ${isActive ? 'active' : ''}`}
      type="button"
      aria-label="Hesabım"
      aria-current={isActive ? 'page' : undefined}
      title="Hesabım"
      onClick={onActivate ?? (() => navigate('/account'))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </svg>
    </button>
  )
}
