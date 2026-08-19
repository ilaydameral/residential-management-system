interface HeaderGlobalSearchButtonProps {
  onActivate: () => void
}

export function HeaderGlobalSearchButton({ onActivate }: HeaderGlobalSearchButtonProps) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const shortcutText = isMac ? '⌘K' : 'Ctrl+K'

  return (
    <button
      className="global-search-trigger-btn"
      type="button"
      onClick={onActivate}
      aria-label="Hızlı arama panelini aç"
      title={`Hızlı Arama (${shortcutText})`}
    >
      <svg
        className="search-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <span className="trigger-text">Hızlı Arama</span>
      <kbd className="shortcut-kbd">{shortcutText}</kbd>
    </button>
  )
}
