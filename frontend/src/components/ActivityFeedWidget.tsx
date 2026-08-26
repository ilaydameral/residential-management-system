import { useCallback, useEffect, useState } from 'react'
import { getActivityFeed } from '../api'
import { useRealtime } from '../realtime/useRealtime'
import type { ActivityFeedItemDto, PagedActivityFeedDto } from '../realtime/types'
import { LoadingSkeleton } from './LoadingSkeleton'

interface ActivityFeedWidgetProps {
  onNavigate?: (view: string, params?: Record<string, string>) => void
  limit?: number
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (isNaN(diffInSeconds) || diffInSeconds < 30) {
    return 'az önce'
  }
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60)
    return `${mins} dk önce`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} saat önce`
  }
  if (diffInSeconds < 172800) {
    return 'dün'
  }
  const days = Math.floor(diffInSeconds / 86400)
  if (days < 7) {
    return `${days} gün önce`
  }
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function getPaginationRange(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, '...', totalPages]
  }

  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

export function ActivityFeedWidget({ onNavigate }: ActivityFeedWidgetProps) {
  const [pagedData, setPagedData] = useState<PagedActivityFeedDto | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { onActivityFeedInvalidated, onMaintenanceRequestUpdated } = useRealtime()

  const fetchFeed = useCallback(async (pageToFetch: number) => {
    setLoading(true)
    try {
      setError(null)
      const data = await getActivityFeed(pageToFetch, 6)
      setPagedData(data)
      setCurrentPage(data.page)
    } catch (err: any) {
      console.error('Failed to load activity feed:', err)
      setError(err?.message || 'Son hareketler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchFeed(1)
  }, [fetchFeed])

  // Realtime updates listener: refetch current page so user view remains stable
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      void fetchFeed(currentPage)
    }
    const unsubFeed = onActivityFeedInvalidated(handleRealtimeUpdate)
    const unsubMaint = onMaintenanceRequestUpdated(handleRealtimeUpdate)
    return () => {
      unsubFeed()
      unsubMaint()
    }
  }, [currentPage, fetchFeed, onActivityFeedInvalidated, onMaintenanceRequestUpdated])

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || newPage < 1 || (pagedData && newPage > pagedData.totalPages)) return
    void fetchFeed(newPage)
  }

  const handleItemClick = (item: ActivityFeedItemDto) => {
    if (!onNavigate || !item.targetView) return
    const params: Record<string, string> = {}
    if (item.routeParams) {
      const searchParams = new URLSearchParams(item.routeParams)
      searchParams.forEach((val, key) => {
        params[key] = val
      })
    }
    onNavigate(item.targetView, params)
  }

  const getCategoryBadge = (category: ActivityFeedItemDto['category']) => {
    switch (category) {
      case 'MAINTENANCE':
        return {
          icon: (
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a1 1 0 01-1-1V9a1 1 0 011-1h1a2 2 0 100-4H4a1 1 0 01-1-1V4a1 1 0 011-1h3a1 1 0 011 1v1z" />
            </svg>
          ),
          typeClass: 'badge-maintenance',
        }
      case 'ANNOUNCEMENT':
        return {
          icon: (
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          ),
          typeClass: 'badge-announcement',
        }
      case 'FINANCE':
        return {
          icon: (
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
          typeClass: 'badge-finance',
        }
      case 'OCCUPANCY':
        return {
          icon: (
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          ),
          typeClass: 'badge-occupancy',
        }
      case 'MANAGEMENT':
      default:
        return {
          icon: (
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          typeClass: 'badge-management',
        }
    }
  }

  const items = pagedData?.items ?? []
  const totalPages = pagedData?.totalPages ?? 1
  const paginationRange = getPaginationRange(currentPage, totalPages)

  return (
    <div className="activity-feed-widget">
      {/* Widget Header */}
      <div className="activity-feed-header">
        <div className="activity-feed-header-title">
          <div className="activity-feed-header-icon">
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3>Son Hareketler</h3>
        </div>

        <button
          onClick={() => void fetchFeed(currentPage)}
          className="activity-feed-refresh-btn"
          title="Yenile"
          type="button"
        >
          <svg width={14} height={14} className={loading ? 'animate-spin' : ''} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Content Area */}
      <div className="activity-feed-list">
        {loading && !pagedData ? (
          <div style={{ padding: '16px' }}>
            <LoadingSkeleton variant="table" rows={3} />
          </div>
        ) : error ? (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-danger, #dc2626)', marginBottom: '8px', fontSize: '0.875rem' }}>{error}</p>
            <button
              onClick={() => void fetchFeed(currentPage)}
              className="secondary-button activity-feed-retry-btn"
              type="button"
            >
              Yeniden Dene
            </button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Henüz görüntülenecek bir hareket yok.
          </div>
        ) : (
          items.map((item) => {
            const badge = getCategoryBadge(item.category)
            const clickable = Boolean(item.targetView && onNavigate)

            return (
              <div
                key={item.id}
                onClick={() => clickable && handleItemClick(item)}
                className={`activity-feed-item ${clickable ? 'clickable' : ''}`}
                title={item.occurredAt ? new Date(item.occurredAt).toLocaleString('tr-TR') : ''}
              >
                {/* Category Icon */}
                <div className={`activity-feed-badge ${badge.typeClass}`}>
                  {badge.icon}
                </div>

                {/* Body */}
                <div className="activity-feed-content">
                  <div className="activity-feed-row-top">
                    <span className="activity-feed-title">
                      {item.title}
                    </span>
                    <span className="activity-feed-time">
                      {formatRelativeTime(item.occurredAt)}
                    </span>
                  </div>

                  <p className="activity-feed-description">
                    {item.description}
                  </p>

                  {item.actorName && (
                    <div className="activity-feed-actor">
                      <span>Kişi: {item.actorName}</span>
                    </div>
                  )}
                </div>

                {/* Arrow Indicator */}
                {clickable && (
                  <svg className="activity-feed-chevron" width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Compact Pagination Bar */}
      {pagedData && pagedData.totalCount > 0 && totalPages > 1 && (
        <nav className="activity-feed-pagination" aria-label="Son Hareketler Sayfalama">
          <button
            type="button"
            className="activity-feed-page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            aria-label="Önceki Sayfa"
            title="Önceki Sayfa"
          >
            ‹
          </button>

          {paginationRange.map((pageItem, idx) => {
            if (typeof pageItem === 'string') {
              return (
                <span key={`ellipsis-${idx}`} className="activity-feed-pagination-ellipsis">
                  …
                </span>
              )
            }

            const isCurrent = pageItem === currentPage

            return (
              <button
                key={`page-${pageItem}`}
                type="button"
                className={`activity-feed-page-btn ${isCurrent ? 'active' : ''}`}
                onClick={() => handlePageChange(pageItem)}
                disabled={loading}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Sayfa ${pageItem}`}
              >
                {pageItem}
              </button>
            )
          })}

          <button
            type="button"
            className="activity-feed-page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            aria-label="Sonraki Sayfa"
            title="Sonraki Sayfa"
          >
            ›
          </button>
        </nav>
      )}
    </div>
  )
}
