import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyAccountProfile } from '../api'
import type { AccountProfile } from '../types'
import { LoadingSkeleton } from './LoadingSkeleton'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Yönetici',
  MANAGER: 'Site Yöneticisi',
  RESIDENT: 'Sakin',
  TECHNICAL_STAFF: 'Teknik Personel',
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Belirtilmemiş'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(parsed)
}

function getInitials(fullName: string): string {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean)
  if (nameParts.length === 0) return '?'

  const firstInitial = Array.from(nameParts[0])[0] ?? ''
  const lastInitial = nameParts.length > 1 ? Array.from(nameParts[nameParts.length - 1])[0] ?? '' : ''
  return `${firstInitial}${lastInitial}`.toLocaleUpperCase('tr-TR')
}

interface AccountProps {
  onOpenSettings?: () => void
}

export function Account({ onOpenSettings }: AccountProps) {
  const navigate = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const displayFullName = profile?.fullName?.trim() || 'Belirtilmemiş'
  const displayUserName = profile?.userName?.trim() || 'Belirtilmemiş'
  const displayEmail = profile?.email?.trim() || 'Belirtilmemiş'
  const displayRoles = profile?.roles?.length
    ? profile.roles.map((role) => ROLE_LABELS[role] || role).join(', ')
    : 'Belirtilmemiş'

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setProfile(await getMyAccountProfile())
    } catch (loadError) {
      setProfile(null)
      setError(loadError instanceof Error ? loadError.message : 'Hesap bilgileriniz yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void loadProfile() }, [loadProfile])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => headingRef.current?.focus())
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  return (
    <section className="resident-view-content account-view">
      <header className="resident-view-header">
        <p className="eyebrow">Kullanıcı Hesabı</p>
        <h1 ref={headingRef} tabIndex={-1}>Hesabım</h1>
        <p>Hesabınıza ait temel bilgileri güvenli biçimde görüntüleyin.</p>
      </header>

      {isLoading && <LoadingSkeleton variant="detail" />}
      {!isLoading && error && (
        <section className="panel entity-state-panel error-state">
          <p className="status-message error-message" role="alert">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void loadProfile()}>Tekrar Dene</button>
        </section>
      )}
      {!isLoading && !error && profile && (
        <section className="panel resident-account-card">
          <div className="resident-account-avatar" aria-hidden="true">{getInitials(profile.fullName)}</div>
          <div>
            <h2>{displayFullName}</h2>
            <p>{displayUserName === 'Belirtilmemiş' ? displayUserName : `@${displayUserName}`}</p>
          </div>
          <dl className="resident-account-details">
            <div><dt>Ad Soyad</dt><dd>{displayFullName}</dd></div>
            <div><dt>Kullanıcı Adı</dt><dd>{displayUserName}</dd></div>
            <div><dt>E-posta</dt><dd>{displayEmail}</dd></div>
            <div><dt>Roller</dt><dd>{displayRoles}</dd></div>
            <div><dt>Hesap Durumu</dt><dd><span className={`status-badge ${profile.isActive ? 'active' : 'inactive'}`}>{profile.isActive ? 'Aktif' : 'Pasif'}</span></dd></div>
            <div><dt>Hesap Oluşturulma Tarihi</dt><dd>{formatDate(profile.createdAt)}</dd></div>
          </dl>
          <div className="account-view-actions">
            <button className="secondary-button" type="button" onClick={onOpenSettings ?? (() => navigate('/settings'))}>
              Ayarları Aç
            </button>
          </div>
        </section>
      )}
    </section>
  )
}
