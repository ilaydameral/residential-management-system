import { useEffect, useRef, useState } from 'react'
import { globalSearch } from '../api'
import type { GlobalSearchItem, GlobalSearchResponse } from '../types'

interface GlobalSearchPaletteProps {
  isOpen: boolean
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

export function GlobalSearchPalette({ isOpen, onClose, onSelectResult }: GlobalSearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<GlobalSearchResponse | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

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

  // Handle open / focus restoration / body lock
  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement as HTMLElement
      setQuery('')
      setResults(null)
      setError(null)
      setSelectedIndex(0)

      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)

      return () => clearTimeout(timer)
    } else {
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus()
      }
    }
  }, [isOpen])

  // Debounced search with AbortController
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

  // Keyboard navigation & Focus Trap
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Priority Check: If ConfirmationDialog is open above search palette, do not handle Escape key
      if (document.querySelector('.confirmation-overlay')) {
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
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
        }
        return
      }

      // Focus Trap inside palette
      if (e.key === 'Tab') {
        if (!paletteRef.current) return
        const focusables = paletteRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, flatItems, selectedIndex, onClose, onSelectResult])

  if (!isOpen) return null

  const isQueryValid = query.trim().length >= 2
  const hasNoResults = isQueryValid && !isLoading && !error && flatItems.length === 0

  let currentItemCounter = 0

  const renderGroup = (key: keyof GlobalSearchResponse, groupItems: GlobalSearchItem[] | undefined) => {
    if (!groupItems || groupItems.length === 0) return null

    const label = GROUP_LABELS[key] || key

    return (
      <div key={key} className="search-result-group">
        <div className="search-group-header">{label}</div>
        <div className="search-group-list">
          {groupItems.map((item) => {
            const itemIndex = currentItemCounter++
            const isSelected = itemIndex === selectedIndex
            const badge = ENTITY_BADGES[item.entityType] || { label: item.entityType, className: '' }

            return (
              <div
                key={`${item.entityType}-${item.id}`}
                className={`search-result-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectResult(item)}
                onMouseEnter={() => setSelectedIndex(itemIndex)}
              >
                <div className="item-icon-wrapper">
                  {item.entityType === 'PROPERTY' && '🏢'}
                  {item.entityType === 'BUILDING' && '🏛️'}
                  {item.entityType === 'UNIT' && '🚪'}
                  {item.entityType === 'USER' && '👤'}
                  {item.entityType === 'MAINTENANCE' && '🛠️'}
                  {item.entityType === 'ANNOUNCEMENT' && '📢'}
                </div>
                <div className="item-content">
                  <div className="item-title">{item.title}</div>
                  <div className="item-subtitle">{item.subtitle}</div>
                </div>
                <span className={`item-badge ${badge.className}`}>{badge.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="search-palette-overlay" onClick={onClose}>
      <div
        ref={paletteRef}
        className="search-palette-container"
        role="dialog"
        aria-modal="true"
        aria-label="Hızlı Arama"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="search-palette-header">
          <svg
            className="palette-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-palette-input"
            placeholder="Yapı, blok, daire, kullanıcı, talep veya duyuru arayın..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="search-palette-close-btn"
            type="button"
            aria-label="Aramayı kapat"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search Body */}
        <div className="search-palette-body">
          {!isQueryValid && !isLoading && (
            <div className="search-palette-initial-state">
              <div className="initial-icon">⚡</div>
              <div className="initial-title">Hızlı Arama</div>
              <div className="initial-text">En az 2 karakter yazarak aramaya başlayın.</div>
              <div className="initial-examples">
                <span className="example-tag">A Blok</span>
                <span className="example-tag">Daire 12</span>
                <span className="example-tag">Ahmet Yılmaz</span>
                <span className="example-tag">Tesisat</span>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="search-state-message loading-state">
              <span className="spinner-small" /> Aranıyor...
            </div>
          )}

          {error && <div className="search-state-message error-state">{error}</div>}

          {hasNoResults && (
            <div className="search-state-message text-muted">Sonuç bulunamadı.</div>
          )}

          {isQueryValid && !isLoading && !error && results && (
            <div className="search-results-wrapper">
              {renderGroup('properties', results.properties)}
              {renderGroup('buildings', results.buildings)}
              {renderGroup('units', results.units)}
              {renderGroup('users', results.users)}
              {renderGroup('maintenanceRequests', results.maintenanceRequests)}
              {renderGroup('announcements', results.announcements)}
            </div>
          )}
        </div>

        {/* Search Footer */}
        <div className="search-palette-footer">
          <span>
            <kbd>↑↓</kbd> Gezin
          </span>
          <span>
            <kbd>↵</kbd> Aç
          </span>
          <span>
            <kbd>Esc</kbd> Kapat
          </span>
        </div>
      </div>
    </div>
  )
}
