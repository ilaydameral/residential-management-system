import type { ResidentUnit } from '../types'
import { groupResidentUnits, OCCUPANCY_TYPE_LABELS } from '../utils/residentUnits'
import { LoadingSkeleton } from './LoadingSkeleton'

interface ResidentHomeProps {
  firstName: string
  units: ResidentUnit[]
  isLoading: boolean
  error: string
  onRetry: () => void
  onNavigate: (path: string) => void
}

export function ResidentHome({
  firstName,
  units,
  isLoading,
  error,
  onRetry,
  onNavigate,
}: ResidentHomeProps) {
  const groupedUnits = groupResidentUnits(units)
  const occupancies = groupedUnits.flatMap((unit) => unit.occupancies)
  const primaryUnitCount = groupedUnits.filter((unit) =>
    unit.occupancies.some((occupancy) => occupancy.isPrimary)
  ).length
  const distribution = Object.entries(OCCUPANCY_TYPE_LABELS).map(([code, label]) => ({
    code,
    label,
    count: occupancies.filter((occupancy) => occupancy.occupancyType === code).length,
  }))

  return (
    <section className="resident-view-content">
      <header className="resident-view-header">
        <p className="eyebrow">Sakin Portalı</p>
        <h1>Hoş geldiniz, {firstName}</h1>
        <p>Hesabınıza bağlı aktif daireleri ve ikamet bilgilerinizi buradan takip edebilirsiniz.</p>
      </header>

      {isLoading && <LoadingSkeleton variant="dashboard" />}
      {!isLoading && error && (
        <section className="panel entity-state-panel error-state">
          <p className="status-message error-message">{error}</p>
          <button className="secondary-button" type="button" onClick={onRetry}>Tekrar Dene</button>
        </section>
      )}

      {!isLoading && !error && (
        <>
          <div className="resident-summary-grid">
            <article className="resident-summary-card">
              <span>Aktif Daire</span>
              <strong>{groupedUnits.length}</strong>
            </article>
            <article className="resident-summary-card">
              <span>Birincil Sakin Olduğum Daire</span>
              <strong>{primaryUnitCount}</strong>
            </article>
            <article className="resident-summary-card resident-role-summary">
              <span>İkamet Dağılımı</span>
              <div>
                {distribution.map((item) => (
                  <span className="resident-role-count" key={item.code}>{item.label}: <strong>{item.count}</strong></span>
                ))}
              </div>
            </article>
          </div>

          {groupedUnits.length === 0 && (
            <section className="panel empty-state-box">
              Henüz hesabınıza bağlı aktif bir daire bulunmuyor.
            </section>
          )}

          <section className="panel resident-quick-actions">
            <div className="section-heading">
              <h2>Hızlı Erişim</h2>
              <p>Daire ve hesap bilgilerinize doğrudan ulaşın.</p>
            </div>
            <div>
              <button className="primary-button" type="button" onClick={() => onNavigate('/resident/my-units')}>Dairelerimi Gör</button>
              <button className="secondary-button" type="button" onClick={() => onNavigate('/resident/account')}>Hesabımı Gör</button>
            </div>
          </section>
        </>
      )}
    </section>
  )
}
