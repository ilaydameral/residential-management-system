import { useCallback, useEffect, useState } from 'react'
import { getActivityFeed } from '../api'
import { useRealtime } from '../realtime/useRealtime'
import type { ActivityFeedItemDto } from '../realtime/types'

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

export function ActivityFeedWidget({ onNavigate, limit = 10 }: ActivityFeedWidgetProps) {
  const [items, setItems] = useState<ActivityFeedItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { onActivityFeedInvalidated, onMaintenanceRequestUpdated } = useRealtime()

  const fetchFeed = useCallback(async () => {
    try {
      setError(null)
      const data = await getActivityFeed(limit)
      setItems(data)
    } catch (err: any) {
      console.error('Failed to load activity feed:', err)
      setError(err?.message || 'Son hareketler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void fetchFeed()
  }, [fetchFeed])

  // Realtime updates listener
  useEffect(() => {
    const unsubFeed = onActivityFeedInvalidated(() => {
      void fetchFeed()
    })
    const unsubMaint = onMaintenanceRequestUpdated(() => {
      void fetchFeed()
    })
    return () => {
      unsubFeed()
      unsubMaint()
    }
  }, [onActivityFeedInvalidated, onMaintenanceRequestUpdated, fetchFeed])

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
            <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a1 1 0 01-1-1V9a1 1 0 011-1h1a2 2 0 100-4H4a1 1 0 01-1-1V4a1 1 0 011-1h3a1 1 0 011 1v1z" />
            </svg>
          ),
          bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
        }
      case 'ANNOUNCEMENT':
        return {
          icon: (
            <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          ),
          bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
        }
      case 'FINANCE':
        return {
          icon: (
            <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
          bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
        }
      case 'OCCUPANCY':
        return {
          icon: (
            <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          ),
          bg: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
        }
      case 'MANAGEMENT':
      default:
        return {
          icon: (
            <svg className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          bg: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800',
        }
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Widget Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Son Hareketler</h3>
        </div>

        <button
          onClick={() => void fetchFeed()}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Yenile"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Content Area */}
      <div className="p-2 flex-1 overflow-y-auto max-h-[460px]">
        {loading && items.length === 0 ? (
          <div className="space-y-2 p-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            <p className="mb-2 text-rose-500 dark:text-rose-400">{error}</p>
            <button
              onClick={() => void fetchFeed()}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Yeniden Dene
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Henüz görüntülenecek bir hareket yok.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {items.map((item) => {
              const badge = getCategoryBadge(item.category)
              const clickable = Boolean(item.targetView && onNavigate)

              return (
                <div
                  key={item.id}
                  onClick={() => clickable && handleItemClick(item)}
                  className={`group p-3 rounded-lg transition-all flex items-start gap-3 text-left ${
                    clickable
                      ? 'hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer'
                      : ''
                  }`}
                  title={item.occurredAt ? new Date(item.occurredAt).toLocaleString('tr-TR') : ''}
                >
                  {/* Category Icon */}
                  <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${badge.bg}`}>
                    {badge.icon}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-normal">
                        {formatRelativeTime(item.occurredAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {item.description}
                    </p>

                    {item.actorName && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                        <span className="truncate">Kişi: {item.actorName}</span>
                      </div>
                    )}
                  </div>

                  {/* Arrow Indicator */}
                  {clickable && (
                    <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
