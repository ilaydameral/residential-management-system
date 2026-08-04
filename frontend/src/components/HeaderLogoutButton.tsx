interface HeaderLogoutButtonProps {
  onActivate: () => void
}

export function HeaderLogoutButton({ onActivate }: HeaderLogoutButtonProps) {
  return (
    <button
      className="theme-toggle-button header-logout-button"
      type="button"
      aria-label="Çıkış Yap"
      title="Çıkış Yap"
      onClick={onActivate}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" />
        <path d="M14 8l4 4-4 4M18 12H9" />
      </svg>
    </button>
  )
}
