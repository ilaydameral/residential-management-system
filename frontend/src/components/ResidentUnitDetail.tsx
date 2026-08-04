import type { GroupedResidentUnit } from '../utils/residentUnits'
import {
  formatResidentDate,
  formatResidentFloor,
  OCCUPANCY_TYPE_LABELS,
} from '../utils/residentUnits'
import { formatUnitNumber } from '../utils/unitDisplay'
import { LoadingSkeleton } from './LoadingSkeleton'

interface ResidentUnitDetailProps {
  unit: GroupedResidentUnit | null
  isLoading: boolean
  error: string
  onRetry: () => void
  onBack: () => void
}

export function ResidentUnitDetail({ unit, isLoading, error, onRetry, onBack }: ResidentUnitDetailProps) {
  return (
    <section className="resident-view-content">
      <div className="resident-detail-heading">
        <div>
          <p className="eyebrow">Daire Detayı</p>
          <h1>{unit ? formatUnitNumber(unit.unitNumber) : 'Daire Bilgileri'}</h1>
          {unit && <p>{unit.propertyName} · {unit.buildingName}</p>}
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>Dairelerime Dön</button>
      </div>

      {isLoading && <LoadingSkeleton variant="detail" />}
      {!isLoading && error && (
        <section className="panel entity-state-panel error-state">
          <p className="status-message error-message">{error}</p>
          <button className="secondary-button" type="button" onClick={onRetry}>Tekrar Dene</button>
        </section>
      )}
      {!isLoading && !error && !unit && (
        <section className="panel entity-state-panel error-state">
          <p className="status-message error-message">İstenen daire hesabınıza bağlı aktif daireler arasında bulunamadı.</p>
          <button className="secondary-button" type="button" onClick={onBack}>Dairelerime Dön</button>
        </section>
      )}

      {!isLoading && !error && unit && (
        <div className="resident-detail-grid">
          <section className="panel resident-detail-panel">
            <div className="section-heading"><h2>Genel Bilgiler</h2></div>
            <dl className="resident-detail-list">
              <div><dt>Yapı</dt><dd>{unit.propertyName}</dd></div>
              <div><dt>Blok / Bina</dt><dd>{unit.buildingName}</dd></div>
              <div><dt>Daire / Bölüm No</dt><dd>{formatUnitNumber(unit.unitNumber)}</dd></div>
              <div><dt>Kat</dt><dd>{formatResidentFloor(unit.floorNumber)}</dd></div>
              <div><dt>Bölüm Türü</dt><dd>{unit.unitTypeName}</dd></div>
              <div><dt>Brüt Alan</dt><dd>{unit.grossArea != null ? `${unit.grossArea} m²` : 'Belirtilmemiş'}</dd></div>
              <div><dt>Net Alan</dt><dd>{unit.netArea != null ? `${unit.netArea} m²` : 'Belirtilmemiş'}</dd></div>
            </dl>
          </section>

          <section className="panel resident-detail-panel">
            <div className="section-heading"><h2>İkamet Bilgim</h2></div>
            <div className="resident-occupancy-list">
              {unit.occupancies.map((occupancy, index) => (
                <article key={`${occupancy.occupancyType}-${occupancy.startDate}-${index}`}>
                  <div className="resident-occupancy-badges">
                    <span className="status-badge occupancy-type-badge">{OCCUPANCY_TYPE_LABELS[occupancy.occupancyType]}</span>
                    {occupancy.isPrimary && <span className="status-badge primary-badge">Birincil Sakin</span>}
                  </div>
                  <dl>
                    <div><dt>İkamet Türü</dt><dd>{OCCUPANCY_TYPE_LABELS[occupancy.occupancyType]}</dd></div>
                    <div><dt>Başlangıç Tarihi</dt><dd>{formatResidentDate(occupancy.startDate)}</dd></div>
                    <div><dt>Birincil Sakin</dt><dd>{occupancy.isPrimary ? 'Evet' : 'Hayır'}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
