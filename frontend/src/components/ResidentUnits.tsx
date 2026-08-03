import { useEffect, useState } from 'react'
import { getMyUnits } from '../api'
import { useAuth } from '../context/AuthContext'
import type { OccupancyTypeCode, ResidentUnit } from '../types'

const OCCUPANCY_TYPE_LABELS: Record<OccupancyTypeCode, string> = {
  OWNER: 'Malik',
  TENANT: 'Kiracı',
  HOUSEHOLD_MEMBER: 'Hane Üyesi',
}

function formatFloor(floorNumber: number): string {
  if (floorNumber === 0) return 'Zemin Kat'
  if (floorNumber < 0) return `Bodrum ${Math.abs(floorNumber)}. Kat`
  return `${floorNumber}. Kat`
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

export function ResidentUnits() {
  const { user, logout } = useAuth()
  const [units, setUnits] = useState<ResidentUnit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCancelled = false

    const loadUnits = async () => {
      setIsLoading(true)
      setError('')

      try {
        const data = await getMyUnits()
        if (!isCancelled) {
          setUnits(data)
        }
      } catch (loadError) {
        if (!isCancelled) {
          setUnits([])
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Daire bilgileriniz yüklenemedi.'
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadUnits()

    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <main className="page-shell resident-page">
      <div className="auth-bar">
        <div className="user-info">
          <span className="user-name">
            {user?.firstName} {user?.lastName} ({user?.userName})
          </span>
          <span className="role-badge resident">Sakin</span>
        </div>
        <button className="secondary-button" type="button" onClick={() => logout()}>
          Çıkış Yap
        </button>
      </div>

      <header className="page-header resident-page-header">
        <p className="eyebrow">Sakin Görünümü</p>
        <h1>Dairelerim</h1>
        <p className="page-description">
          Hesabınıza bağlı güncel daire bilgilerini görüntüleyin.
        </p>
      </header>

      <section className="section-container resident-units-section">
        <section className="panel">
          <div className="section-heading">
            <h2>Aktif Dairelerim</h2>
            {!isLoading && !error && <p>{units.length} aktif kayıt bulundu.</p>}
          </div>

          {isLoading && <p className="status-message">Daire bilgileriniz yükleniyor...</p>}
          {error && <p className="status-message error-message" role="alert">{error}</p>}
          {!isLoading && !error && units.length === 0 && (
            <p className="status-message empty-state-box">
              Henüz hesabınıza bağlı aktif bir daire bulunmuyor.
            </p>
          )}

          <div className="resident-unit-grid">
            {units.map((unit) => (
              <article
                className="item-card resident-unit-card"
                key={`${unit.unitId}-${unit.occupancyType}-${unit.startDate}`}
              >
                <div className="card-header">
                  <div>
                    <h3>{unit.propertyName}</h3>
                    <p className="subtitle">{unit.buildingName}</p>
                  </div>
                  {unit.isPrimary && (
                    <span className="status-badge primary-badge">Birincil Sakin</span>
                  )}
                </div>

                <dl className="resident-unit-details">
                  <div>
                    <dt>Kapı / Bölüm No</dt>
                    <dd>{unit.unitNumber}</dd>
                  </div>
                  <div>
                    <dt>Kat</dt>
                    <dd>{formatFloor(unit.floorNumber)}</dd>
                  </div>
                  <div>
                    <dt>İkamet Türü</dt>
                    <dd>{OCCUPANCY_TYPE_LABELS[unit.occupancyType] ?? 'Bilinmeyen'}</dd>
                  </div>
                  <div>
                    <dt>Birincil Sakin</dt>
                    <dd>{unit.isPrimary ? 'Evet' : 'Hayır'}</dd>
                  </div>
                  <div>
                    <dt>Başlangıç Tarihi</dt>
                    <dd>{formatDate(unit.startDate)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
