import { useCallback, useEffect, useState } from 'react'
import { getDashboardSummary } from '../api'
import type { DashboardSummary } from '../types'
import { LoadingSkeleton } from './LoadingSkeleton'

type DashboardTargetView = 'properties' | 'units' | 'residents' | 'users'

interface DashboardOverviewProps {
  onNavigate: (view: DashboardTargetView) => void
}

const SUMMARY_CARDS: Array<{
  key: keyof DashboardSummary
  label: string
  tone: string
}> = [
  { key: 'propertyCount', label: 'Toplam Yapı', tone: 'blue' },
  { key: 'buildingCount', label: 'Toplam Blok', tone: 'indigo' },
  { key: 'unitCount', label: 'Toplam Daire', tone: 'slate' },
  { key: 'activeOccupancyCount', label: 'Aktif Sakin', tone: 'green' },
  { key: 'occupiedUnitCount', label: 'Dolu Daire', tone: 'green' },
  { key: 'vacantUnitCount', label: 'Boş Daire', tone: 'slate' },
]

const QUICK_ACTIONS: Array<{
  label: string
  description: string
  view: DashboardTargetView
}> = [
  { label: 'Yeni Yapı', description: 'Yapı yönetimine git', view: 'properties' },
  { label: 'Yeni Daire', description: 'Daire yönetimine git', view: 'units' },
  { label: 'Sakin Ata', description: 'Site sakinlerine git', view: 'residents' },
  { label: 'Kullanıcı Ara', description: 'Kullanıcılara git', view: 'users' },
]

export default function DashboardOverview({ onNavigate }: DashboardOverviewProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const data = await getDashboardSummary()
      setSummary(data)
    } catch (loadError) {
      setSummary(null)
      setError(loadError instanceof Error ? loadError.message : 'Yönetim özeti yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  return (
    <section className="dashboard-overview" aria-live="polite">
      <section className="panel overview-welcome-panel">
        <p className="eyebrow">Hoş Geldiniz</p>
        <h2>Yönetim özetiniz</h2>
        <p>Aktif yapıların, dairelerin ve sakin kayıtlarının güncel durumunu buradan izleyebilirsiniz.</p>
      </section>

      {isLoading && (
        <LoadingSkeleton variant="dashboard" />
      )}

      {!isLoading && error && (
        <section className="panel dashboard-state-panel">
          <p className="status-message error-message">{error}</p>
          <button className="secondary-button dashboard-retry-button" type="button" onClick={() => void loadSummary()}>
            Tekrar Dene
          </button>
        </section>
      )}

      {!isLoading && !error && summary && (
        <div className="dashboard-summary-grid">
          {SUMMARY_CARDS.map((card) => (
            <article className={`dashboard-summary-card ${card.tone}`} key={card.key}>
              <span>{card.label}</span>
              <strong>{summary[card.key]}</strong>
            </article>
          ))}
        </div>
      )}

      <section className="panel dashboard-actions-panel">
        <div className="section-heading">
          <h2>Hızlı İşlemler</h2>
          <p>Sık kullanılan yönetim ekranlarına doğrudan geçin.</p>
        </div>
        <div className="dashboard-actions-grid">
          {QUICK_ACTIONS.map((action) => (
            <button key={action.label} type="button" onClick={() => onNavigate(action.view)}>
              <strong>{action.label}</strong>
              <span>{action.description} →</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  )
}
