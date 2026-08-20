import { useEffect, useRef, useState } from 'react'
import { globalSearch } from '../api'
import type { GlobalSearchItem, GlobalSearchResponse } from '../types'

interface HeaderGlobalSearchButtonProps {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onSelectResult: (item: GlobalSearchItem) => void
}

const GROUP_LABELS: Record<string, string> = {
  properties: 'Yapılar',
  buildings: 'Bloklar',
  units: 'Daireler',
  users: 'Kullanıcılar',
  maintenanceRequests: 'Bakım Talepleri',
  announcements: 'Duyurular',
}

const ENTITY_BADGES: Record<string, { label: string; className: string }> = {
  PROPERTY: { label: 'Site / Yapı', className: 'badge-property' },
  BUILDING: { label: 'Blok', className: 'badge-building' },
  UNIT: { label: 'Daire', className: 'badge-unit' },
  USER: { label: 'Kullanıcı', className: 'badge-user' },
  MAINTENANCE: { label: 'Bakım Talebi', className: 'badge-maintenance' },
  ANNOUNCEMENT: { label: 'Duyuru', className: 'badge-announcement' },
}

export function HeaderGlobalSearchButton({
  isOpen,
  onOpen,
  onClose,
  onSelectResult,
}: HeaderGlobalSearchButtonProps) {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<GlobalSearchResponse | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const shortcutText = isMac ? '⌘K' : 'Ctrl+K'

  // Flattened results list for keyboard navigation
  const flatItems: GlobalSearchItem[] = []
  if (results) {
    if (results.properties?.length) flatItems.push(...results.properties)
    if (results.buildings?.length) flatItems.push(...results.buildings)
    if (results.units?.length) flatItems.push(...results.units)
    if (results.users?.length) flatItems.push(...results.users)
    if (results.maintenanceRequests?.length) flatItems.push(...results.maintenanceRequests)
    if (results.announcements?.length) flatItems.push(...results.announcements)
  }

  // Sync focus & state when isOpen changes (e.g. Cmd+K pressed globally)
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    } else {
      setQuery('')
      setResults(null)
      setError(null)
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Debounced search API call with AbortController
  useEffect(() => {
    const trimmed = query.trim()

    if (!isOpen || trimmed.length < 2) {
      setResults(null)
      setIsLoading(false)
      setError(null)
      setSelectedIndex(0)
      return
    }

    setIsLoading(true)
    setError(null)

    const abortController = new AbortController()

    const debounceTimer = setTimeout(async () => {
      try {
        const data = await globalSearch(trimmed, 5, abortController.signal)
        setResults(data)
        setSelectedIndex(0)
        setIsLoading(false)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError('Arama sırasında bir hata oluştu.')
          setIsLoading(false)
        }
      }
    }, 250)

    return () => {
      clearTimeout(debounceTimer)
      abortController.abort()
    }
  }, [query, isOpen])

  // Click Outside Listener
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Keyboard navigation inside input / dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      inputRef.current?.blur()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % flatItems.length)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length)
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (flatItems.length > 0 && selectedIndex >= 0 && selectedIndex < flatItems.length) {
        onSelectResult(flatItems[selectedIndex])
        onClose()
      }
    }
  }

  const isQueryValid = query.trim().length >= 2
  const hasNoResults = isQueryValid && !isLoading && !error && flatItems.length === 0
  let currentItemCounter = 0

  const renderGroup = (key: keyof GlobalSearchResponse, groupItems: GlobalSearchItem[] | undefined) => {
    if (!groupItems || groupItems.length === 0) return null
    const label = GROUP_LABELS[key] || key

    return (
      <div key={key} className="topbar-search-group">
        <div className="topbar-search-group-title">{label}</div>
        <div className="topbar-search-group-items">
          {groupItems.map((item) => {
            const itemIndex = currentItemCounter++
            const isSelected = itemIndex === selectedIndex
            const badge = ENTITY_BADGES[item.entityType] || { label: item.entityType, className: '' }

            return (
              <div
                key={`${item.entityType}-${item.id}`}
                className={`topbar-search-item ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onSelectResult(item)
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(itemIndex)}
              >
                <div className="topbar-search-item-info">
                  <span className="topbar-search-item-title">{item.title}</span>
                  {item.subtitle && <span className="topbar-search-item-subtitle">{item.subtitle}</span>}
                </div>
                <span className={`topbar-search-badge ${badge.className}`}>{badge.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`topbar-search-container ${isOpen ? 'is-expanded' : ''}`}
    >
      <div className="topbar-search-input-wrapper">
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

        <input
          ref={inputRef}
          type="text"
          className="topbar-search-input"
          placeholder={isOpen ? 'Yapı, daire, kişi veya talep arayın...' : 'Ara'}
          value={query}
          onFocus={onOpen}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Arama girin"
        />

        {!isOpen && <kbd className="shortcut-kbd">{shortcutText}</kbd>}

        {isOpen && query.length > 0 && (
          <button
            type="button"
            className="topbar-search-clear-btn"
            onClick={() => setQuery('')}
            aria-label="Aramayı temizle"
          >
            ✕
          </button>
        )}
      </div>

      {/* Anchored Search Results Dropdown Panel */}
      {isOpen && (
        <div className="topbar-search-dropdown-panel" role="region" aria-label="Arama Sonuçları">
          {!isQueryValid && !isLoading && (
            <div className="topbar-search-initial-compact">
              <div className="initial-hint-row">
                <span className="hint-icon">⚡</span>
                <span className="hint-text">En az 2 karakter yazın</span>
              </div>
              <div className="initial-hint-chips">
                <span className="hint-chip">A Blok</span>
                <span className="hint-chip">Daire 12</span>
                <span className="hint-chip">Ahmet Yılmaz</span>
                <span className="hint-chip">Tesisat</span>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="topbar-search-message loading-message">
              <span className="spinner-small" /> Aranıyor...
            </div>
          )}

          {error && <div className="topbar-search-message error-message">{error}</div>}

          {hasNoResults && (
            <div className="topbar-search-message empty-message">Sonuç bulunamadı.</div>
          )}

          {isQueryValid && !isLoading && !error && results && (
            <>
              <div className="topbar-search-results">
                {renderGroup('properties', results.properties)}
                {renderGroup('buildings', results.buildings)}
                {renderGroup('units', results.units)}
                {renderGroup('users', results.users)}
                {renderGroup('maintenanceRequests', results.maintenanceRequests)}
                {renderGroup('announcements', results.announcements)}
              </div>
              {flatItems.length > 0 && (
                <div className="topbar-search-dropdown-footer">
                  <span><kbd>↑↓</kbd> Gezin</span>
                  <span><kbd>Enter</kbd> Aç</span>
                  <span><kbd>Esc</kbd> Kapat</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
