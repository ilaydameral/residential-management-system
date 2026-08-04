import { useCallback, useEffect, useState } from 'react'
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
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(parsed)
}

export function ResidentAccount() {
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <section className="resident-view-content">
      <header className="resident-view-header">
        <p className="eyebrow">Sakin Portalı</p>
        <h1>Hesabım</h1>
        <p>Hesabınıza ait temel bilgileri güvenli biçimde görüntüleyin.</p>
      </header>

      {isLoading && <LoadingSkeleton variant="detail" />}
      {!isLoading && error && (
        <section className="panel entity-state-panel error-state">
          <p className="status-message error-message">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void loadProfile()}>Tekrar Dene</button>
        </section>
      )}
      {!isLoading && !error && profile && (
        <section className="panel resident-account-card">
          <div className="resident-account-avatar" aria-hidden="true">{profile.fullName.charAt(0).toLocaleUpperCase('tr-TR')}</div>
          <div>
            <h2>{profile.fullName}</h2>
            <p>{profile.email}</p>
          </div>
          <dl className="resident-account-details">
            <div><dt>Ad Soyad</dt><dd>{profile.fullName}</dd></div>
            <div><dt>E-posta</dt><dd>{profile.email}</dd></div>
            <div><dt>Rol</dt><dd>{profile.roles.map((role) => ROLE_LABELS[role] || 'Tanımlı Rol').join(', ')}</dd></div>
            <div><dt>Hesap Durumu</dt><dd><span className={`status-badge ${profile.isActive ? 'active' : 'inactive'}`}>{profile.isActive ? 'Aktif' : 'Pasif'}</span></dd></div>
            <div><dt>Hesap Oluşturulma Tarihi</dt><dd>{formatDate(profile.createdAt)}</dd></div>
          </dl>
        </section>
      )}
    </section>
  )
}
