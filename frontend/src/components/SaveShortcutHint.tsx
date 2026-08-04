export function SaveShortcutHint() {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  const label = isMac ? '⌘ S' : 'Ctrl S'

  return <small className="drawer-shortcut-hint">Kaydet: <kbd>{label}</kbd></small>
}
