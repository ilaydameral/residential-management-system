import type { ResidentUnit } from '../types'
import {
  formatResidentDate,
  formatResidentFloor,
  groupResidentUnits,
  OCCUPANCY_TYPE_LABELS,
} from '../utils/residentUnits'
import { formatUnitNumber } from '../utils/unitDisplay'
import { LoadingSkeleton } from './LoadingSkeleton'

interface ResidentUnitsProps {
  units: ResidentUnit[]
  isLoading: boolean
  error: string
  onRetry: () => void
  onOpenDetail: (unitId: number) => void
}

export function ResidentUnits({
  units,
  isLoading,
  error,
  onRetry,
  onOpenDetail,
}: ResidentUnitsProps) {
  const groupedUnits = groupResidentUnits(units)

  return (
    <section className="resident-view-content">
      <header className="resident-view-header">
        <p className="eyebrow">Sakin Portalı</p>
        <h1>Dairelerim</h1>
        <p>Hesabınıza bağlı aktif daireleri ve ikamet bilgilerinizi görüntüleyin.</p>
      </header>

      {isLoading && <LoadingSkeleton variant="detail" />}
      {!isLoading && error && (
        <section className="panel entity-state-panel error-state">
          <p className="status-message error-message" role="alert">{error}</p>
          <button className="secondary-button" type="button" onClick={onRetry}>Tekrar Dene</button>
        </section>
      )}
      {!isLoading && !error && groupedUnits.length === 0 && (
        <section className="panel empty-state-box">
          Henüz hesabınıza bağlı aktif bir daire bulunmuyor.
        </section>
      )}

      {!isLoading && !error && groupedUnits.length > 0 && (
        <div className="resident-unit-grid">
          {groupedUnits.map((unit) => (
            <article className="panel resident-unit-card" key={unit.unitId}>
              <div className="card-header">
                <div>
                  <h2>{unit.propertyName}</h2>
                  <p className="subtitle">{unit.buildingName}</p>
                </div>
                <span className="resident-unit-number">{formatUnitNumber(unit.unitNumber)}</span>
              </div>

              <dl className="resident-unit-details">
                <div><dt>Kat</dt><dd>{formatResidentFloor(unit.floorNumber)}</dd></div>
                <div>
                  <dt>İkamet Türü</dt>
                  <dd className="resident-inline-badges">
                    {unit.occupancies.map((occupancy, index) => (
                      <span className="status-badge occupancy-type-badge" key={`${occupancy.occupancyType}-${occupancy.startDate}-${index}`}>
                        {OCCUPANCY_TYPE_LABELS[occupancy.occupancyType]}
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Birincil Sakin</dt>
                  <dd>{unit.occupancies.some((occupancy) => occupancy.isPrimary) ? 'Evet' : 'Hayır'}</dd>
                </div>
                <div>
                  <dt>Başlangıç Tarihi</dt>
                  <dd>{unit.occupancies.map((occupancy) => formatResidentDate(occupancy.startDate)).join(', ')}</dd>
                </div>
              </dl>

              <div className="resident-card-actions">
                <button className="primary-button" type="button" onClick={() => onOpenDetail(unit.unitId)}>
                  Daire Detayını Gör
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
