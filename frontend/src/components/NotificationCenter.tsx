import React, { useEffect, useRef, useState } from 'react'
import {
  dismissNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../api'
import type { NotificationDto } from '../types'

interface NotificationCenterProps {
  onNavigateToView?: (view: string) => void
  onNavigateToUrl?: (url: string) => void
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function FinanceIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function AnnouncementIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function RequestIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function CheckDoubleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 12l5 5L22 4" />
      <path d="M2 12l5 5L12 12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function formatNotificationDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return 'Az önce'
    if (diffMin < 60) return `${diffMin} dk önce`

    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours} saat önce`

    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

function getTypeBadge(type: string) {
  switch (type?.toUpperCase()) {
    case 'FINANCE':
      return { label: 'Finans', bg: '#eff6ff', color: '#1d4ed8', icon: <FinanceIcon /> }
    case 'ANNOUNCEMENT':
      return { label: 'Duyuru', bg: '#fffbeb', color: '#b45309', icon: <AnnouncementIcon /> }
    case 'REQUEST':
      return { label: 'Talep', bg: '#f0fdf4', color: '#15803d', icon: <RequestIcon /> }
    case 'SYSTEM':
    default:
      return { label: 'Sistem', bg: '#f8fafc', color: '#475569', icon: <SystemIcon /> }
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onNavigateToView,
  onNavigateToUrl,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // Initial fetch and low-frequency poll for unread count
  const fetchUnreadCount = async () => {
    try {
      const res = await getUnreadNotificationCount()
      setUnreadCount(res.unreadCount)
    } catch {
      // Ignore background poll errors
    }
  }

  useEffect(() => {
    void fetchUnreadCount()
    const timer = setInterval(() => { void fetchUnreadCount() }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Fetch full notifications list when panel opens
  const fetchNotifications = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getNotifications(false)
      setNotifications(data)
      const count = data.filter((n) => !n.isRead).length
      setUnreadCount(count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bildirimler yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }

  const togglePanel = () => {
    if (!isOpen) {
      void fetchNotifications()
    }
    setIsOpen(!isOpen)
  }

  // Close on click outside or ESC key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Mark single notification as read & optionally navigate
  const handleItemClick = async (item: NotificationDto) => {
    if (!item.isRead) {
      try {
        await markNotificationAsRead(item.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch {
        // Continue even if mark read fails
      }
    }

    // Supported Route Navigation
    if (item.relatedEntityName) {
      const entity = item.relatedEntityName
      if (entity === 'PaymentSubmission') {
        if (onNavigateToView) onNavigateToView('paymentSubmissions')
        if (onNavigateToUrl) onNavigateToUrl('/resident/finance')
      } else if (entity === 'DuePeriod' || entity === 'Expense') {
        if (onNavigateToView) onNavigateToView('financeOverview')
        if (onNavigateToUrl) onNavigateToUrl('/resident/finance')
      }
      setIsOpen(false)
    }
  }

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true)
    try {
      await markAllNotificationsAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      // Ignore
    } finally {
      setIsMarkingAll(false)
    }
  }

  // Dismiss item from list
  const handleDismiss = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      await dismissNotification(id)
      const target = notifications.find((n) => n.id === id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch {
      // Ignore dismiss error
    }
  }

  return (
    <div ref={containerRef} className="notification-center-wrapper">
      <button
        type="button"
        className={`notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={togglePanel}
        aria-label={`Bildirimler ${unreadCount > 0 ? `(${unreadCount} okunmamış)` : ''}`}
        aria-expanded={isOpen}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown-panel" role="dialog" aria-label="Bildirim Paneli">
          <div className="notification-panel-header">
            <div className="notification-header-row-1">
              <h3 className="notification-panel-title">Bildirimler</h3>
            </div>

            <div className="notification-header-row-2">
              <span className="notification-unread-subtext">
                {unreadCount > 0 ? `${unreadCount} okunmamış` : 'Tümü okundu'}
              </span>

              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-mark-all-btn"
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAll}
                >
                  <CheckDoubleIcon />
                  <span>Tümünü okundu işaretle</span>
                </button>
              )}
            </div>
          </div>

          <div className="notification-panel-body">
            {isLoading ? (
              <div className="notification-loading-skeleton">
                <div className="skeleton-item" />
                <div className="skeleton-item" />
                <div className="skeleton-item" />
              </div>
            ) : error ? (
              <div className="notification-error-state">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => { void fetchNotifications() }}
                  className="notification-retry-btn"
                >
                  Tekrar Dene
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty-state">
                <div className="empty-icon">
                  <BellIcon />
                </div>
                <p>Henüz bildiriminiz bulunmuyor.</p>
              </div>
            ) : (
              <ul className="notification-list">
                {notifications.map((item) => {
                  const badge = getTypeBadge(item.notificationType)
                  return (
                    <li
                      key={item.id}
                      className={`notification-item ${!item.isRead ? 'unread' : 'read'}`}
                      onClick={() => { void handleItemClick(item) }}
                    >
                      <div className="notification-item-main">
                        <div className="notification-item-header">
                          <span
                            className="notification-type-badge"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>

                          <span className="notification-time">
                            {formatNotificationDate(item.createdAt)}
                          </span>
                        </div>

                        <h4 className="notification-title">
                          {!item.isRead && <span className="unread-dot" />}
                          {item.title}
                        </h4>

                        <p className="notification-message">{item.message}</p>
                      </div>

                      <button
                        type="button"
                        className="notification-dismiss-btn"
                        title="Listeden kaldır"
                        onClick={(e) => { void handleDismiss(e, item.id) }}
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
