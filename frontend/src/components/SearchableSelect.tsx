import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { normalizeTurkishText } from '../data/turkeyLocations'

interface SearchableSelectProps {
  id: string
  label: string
  value: string
  options: string[]
  placeholder: string
  disabled?: boolean
  required?: boolean
  onChange: (value: string) => void
}

/**
 * Computes a match relevance score for an option given a search query.
 * Lower score means higher priority.
 * - 0: Exact match
 * - 1: Option starts with query
 * - 2: A word in the option starts with query
 * - 3: Option contains query anywhere
 * - null: No match
 */
function getMatchScore(option: string, query: string): number | null {
  if (!query) return 0

  const normOpt = normalizeTurkishText(option)
  const normQuery = normalizeTurkishText(query)

  if (!normQuery) return 0

  // 0: Exact match
  if (normOpt === normQuery) return 0

  // 1: Option starts with search query
  if (normOpt.startsWith(normQuery)) return 1

  // 2: A word inside option starts with search query
  const words = normOpt.split(/[\s\-_/]+/)
  if (words.some((w) => w.startsWith(normQuery))) return 2

  // 3: Option contains query anywhere
  if (normOpt.includes(normQuery)) return 3

  return null
}

export function SearchableSelect({
  id,
  label,
  value,
  options,
  placeholder,
  disabled = false,
  required = false,
  onChange,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter and sort options based on Turkish relevance scoring
  const filteredOptions = (() => {
    const trimmed = searchTerm.trim()
    if (!trimmed) {
      return options
    }

    const scored: { option: string; score: number }[] = []
    for (const opt of options) {
      const score = getMatchScore(opt, trimmed)
      if (score !== null) {
        scored.push({ option: opt, score })
      }
    }

    scored.sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score
      }
      return a.option.localeCompare(b.option, 'tr-TR')
    })

    return scored.map((item) => item.option)
  })()

  // Reset highlighted index to top result whenever search term or options change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchTerm, options])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true)
    }
  }

  const handleInputChange = (text: string) => {
    setSearchTerm(text)
    setIsOpen(true)
    onChange(text)
  }

  const handleSelectOption = (option: string) => {
    onChange(option)
    setSearchTerm('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isOpen && filteredOptions[highlightedIndex]) {
        handleSelectOption(filteredOptions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
    }
  }

  const displayValue = isOpen ? searchTerm : value

  return (
    <div className="searchable-select-container" ref={containerRef}>
      <label htmlFor={id} className="searchable-select-label">
        {label} {required && <span className="required-star">*</span>}
      </label>

      <div className="searchable-select-input-wrapper">
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-disabled={disabled}
          disabled={disabled}
          required={required && !value}
          placeholder={disabled ? 'Önce il seçiniz' : placeholder}
          value={displayValue}
          onFocus={handleInputFocus}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="searchable-select-input"
        />

        <span className={`select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && !disabled && (
        <ul id={`${id}-listbox`} role="listbox" className="searchable-select-dropdown">
          {filteredOptions.length === 0 ? (
            <li className="no-options-item">Sonuç bulunamadı</li>
          ) : (
            filteredOptions.map((opt, index) => {
              const isSelected = opt === value
              const isHighlighted = index === highlightedIndex

              return (
                <li
                  key={opt}
                  role="option"
                  aria-selected={isSelected}
                  className={`select-option ${isSelected ? 'selected' : ''} ${
                    isHighlighted ? 'highlighted' : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelectOption(opt)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {opt}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
