interface UserAvatarProps {
  profileImageUrl?: string | null
  displayName?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function getInitials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserAvatar({ profileImageUrl, displayName, size = 'md', className = '' }: UserAvatarProps) {
  const initials = getInitials(displayName)
  const sizeClass = `avatar-${size}`

  if (profileImageUrl) {
    return (
      <div className={`user-avatar ${sizeClass} ${className}`}>
        <img src={profileImageUrl} alt={displayName || 'Kullanıcı'} className="avatar-img" />
      </div>
    )
  }

  if (displayName) {
    return (
      <div className={`user-avatar ${sizeClass} ${className}`} aria-hidden="true">
        <span className="avatar-initials">{initials}</span>
      </div>
    )
  }

  return (
    <div className={`user-avatar ${sizeClass} ${className}`} aria-hidden="true">
      <svg className="avatar-fallback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  )
}
