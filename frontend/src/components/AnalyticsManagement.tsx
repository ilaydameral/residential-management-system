import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getBuildingsByProperty,
  getFacilityAnalytics,
  getFinanceAnalytics,
  getMaintenanceAnalytics,
  getProperties,
  generateAnalyticsAiInsight,
} from '../api'
import type {
  AnalyticsAiInsight,
  AnalyticsKpiComparison,
  AnalyticsFilters,
  Building,
  FacilityAnalytics,
  FinanceAnalytics,
  MaintenanceAnalytics,
  Property,
} from '../types'
import { LoadingSkeleton } from './LoadingSkeleton'
import { PageHeader } from './PageHeader'

type Preset = '30d' | 'month' | '3m' | 'year' | 'custom'

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: 'Tesisat', ELECTRICAL: 'Elektrik', HEATING_COOLING: 'Isıtma / Soğutma',
  ELEVATOR: 'Asansör', CLEANING: 'Temizlik', SECURITY: 'Güvenlik', STRUCTURAL: 'Yapısal', OTHER: 'Diğer',
}
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Açık', IN_PROGRESS: 'İşlemde', RESOLVED: 'Çözüldü', CLOSED: 'Kapatıldı', CANCELLED: 'İptal',
  PENDING: 'Bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', COMPLETED: 'Tamamlandı',
}
const EXPENSE_LABELS: Record<string, string> = {
  MAINTENANCE: 'Bakım', REPAIR: 'Onarım', UTILITIES: 'Faturalar', CLEANING: 'Temizlik',
  SECURITY: 'Güvenlik', STAFF: 'Personel', TAX: 'Vergi', INSURANCE: 'Sigorta', OTHER: 'Diğer',
}

function toInputDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function presetDates(preset: Exclude<Preset, 'custom'>): Pick<AnalyticsFilters, 'fromDate' | 'toDate'> {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  if (preset === '30d') start.setDate(start.getDate() - 29)
  if (preset === 'month') start.setDate(1)
  if (preset === '3m') start.setDate(start.getDate() - 89)
  if (preset === 'year') start.setMonth(0, 1)
  return { fromDate: toInputDate(start), toDate: toInputDate(end) }
}

function inclusiveCalendarDayCount(fromDate: string, toDate: string): number {
  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number)
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number)
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay)
  return Math.floor((toUtc - fromUtc) / 86_400_000) + 1
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value)
}

function formatPeriod(value: string): string {
  const parts = value.split('-').map(Number)
  const date = parts.length === 2
    ? new Date(parts[0], parts[1] - 1, 1)
    : new Date(parts[0], parts[1] - 1, parts[2])
  return new Intl.DateTimeFormat('tr-TR', parts.length === 2
    ? { month: 'short', year: 'numeric' }
    : { day: '2-digit', month: 'short' }).format(date)
}

function comparisonLabel(comparison?: AnalyticsKpiComparison): string | null {
  if (!comparison || comparison.currentValue === null || comparison.previousValue === null) return null
  if (comparison.percentageChange === null) {
    return comparison.previousValue === 0 && comparison.currentValue > 0 ? 'Yeni' : null
  }

  const direction = comparison.percentageChange > 0 ? '↑' : comparison.percentageChange < 0 ? '↓' : '→'
  const percentage = Math.abs(comparison.percentageChange).toLocaleString('tr-TR', { maximumFractionDigits: 1 })
  return `${direction} %${percentage} önceki döneme göre`
}

function MetricCard({
  label, value, hint, comparison,
}: {
  label: string
  value: string | number
  hint?: string
  comparison?: AnalyticsKpiComparison
}) {
  const comparisonText = comparisonLabel(comparison)
  return (
    <article className="analytics-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {comparisonText && <small className="analytics-comparison">{comparisonText}</small>}
      {hint && <small>{hint}</small>}
    </article>
  )
}

function HorizontalBars({
  title, items, emptyText = 'Bu aralıkta veri bulunmuyor.',
}: {
  title: string
  items: Array<{ key: string; label: string; value: number; display: string }>
  emptyText?: string
}) {
  const max = Math.max(0, ...items.map((item) => item.value))
  return (
    <section className="panel analytics-chart-card">
      <h3>{title}</h3>
      {max <= 0 ? <p className="analytics-empty-chart">{emptyText}</p> : (
        <div className="analytics-horizontal-bars">
          {items.map((item) => (
            <div className="analytics-bar-row" key={item.key}>
              <div><span>{item.label}</span><strong>{item.display}</strong></div>
              <span className="analytics-bar-track" aria-hidden="true"><span style={{ width: `${Math.max(4, item.value * 100 / max)}%` }} /></span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function TrendBars({
  title, points, primaryLabel = 'Değer', secondaryLabel,
}: {
  title: string
  points: Array<{ key: string; primary: number; secondary?: number }>
  primaryLabel?: string
  secondaryLabel?: string
}) {
  const max = Math.max(0, ...points.flatMap((point) => [point.primary, point.secondary ?? 0]))
  return (
    <section className="panel analytics-chart-card analytics-trend-card">
      <div className="analytics-chart-heading"><h3>{title}</h3>{secondaryLabel && <span><i /> {primaryLabel} <i className="secondary" /> {secondaryLabel}</span>}</div>
      {max <= 0 ? <p className="analytics-empty-chart">Bu aralıkta trend verisi bulunmuyor.</p> : (
        <div className="analytics-trend" role="img" aria-label={`${title} sütun grafiği`}>
          {points.map((point) => (
            <div className="analytics-trend-column" key={point.key} title={`${formatPeriod(point.key)}: ${point.primary}${point.secondary !== undefined ? ` / ${point.secondary}` : ''}`}>
              <div className="analytics-trend-bars">
                <span style={{ height: `${Math.max(3, point.primary * 100 / max)}%` }} />
                {point.secondary !== undefined && <span className="secondary" style={{ height: `${Math.max(3, point.secondary * 100 / max)}%` }} />}
              </div>
              <small>{formatPeriod(point.key)}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function AnalyticsManagement() {
  const initialDates = useMemo(() => presetDates('30d'), [])
  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [propertyId, setPropertyId] = useState<number | 'all'>('all')
  const [buildingId, setBuildingId] = useState<number | 'all'>('all')
  const [preset, setPreset] = useState<Preset>('30d')
  const [fromDate, setFromDate] = useState(initialDates.fromDate)
  const [toDate, setToDate] = useState(initialDates.toDate)
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>({ ...initialDates })
  const [finance, setFinance] = useState<FinanceAnalytics | null>(null)
  const [maintenance, setMaintenance] = useState<MaintenanceAnalytics | null>(null)
  const [facilities, setFacilities] = useState<FacilityAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')
  const [aiInsight, setAiInsight] = useState<AnalyticsAiInsight | null>(null)
  const [aiError, setAiError] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const aiRequestVersionRef = useRef(0)

  const hasUnappliedFilters =
    (propertyId === 'all' ? undefined : propertyId) !== appliedFilters.propertyId ||
    (buildingId === 'all' ? undefined : buildingId) !== appliedFilters.buildingId ||
    fromDate !== appliedFilters.fromDate ||
    toDate !== appliedFilters.toDate

  useEffect(() => {
    getProperties(false).then((items) => setProperties(items.filter((item) => item.isActive))).catch(() => setProperties([]))
  }, [])

  useEffect(() => {
    if (propertyId === 'all') {
      setBuildings([])
      setBuildingId('all')
      return
    }

    let isCurrentRequest = true
    setBuildings([])
    getBuildingsByProperty(propertyId, false)
      .then((items) => {
        if (isCurrentRequest) setBuildings(items.filter((item) => item.isActive))
      })
      .catch(() => {
        if (isCurrentRequest) setBuildings([])
      })

    return () => { isCurrentRequest = false }
  }, [propertyId])

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [financeResult, maintenanceResult, facilityResult] = await Promise.all([
        getFinanceAnalytics(appliedFilters),
        getMaintenanceAnalytics(appliedFilters),
        getFacilityAnalytics(appliedFilters),
      ])
      setFinance(financeResult)
      setMaintenance(maintenanceResult)
      setFacilities(facilityResult)
    } catch (loadError) {
      setFinance(null)
      setMaintenance(null)
      setFacilities(null)
      setError(loadError instanceof Error ? loadError.message : 'Analytics verileri yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [appliedFilters])

  useEffect(() => { void loadAnalytics() }, [loadAnalytics])

  useEffect(() => {
    aiRequestVersionRef.current += 1
    setAiInsight(null)
    setAiError('')
    setIsAiLoading(false)
  }, [propertyId, buildingId, fromDate, toDate])

  const selectPreset = (value: Exclude<Preset, 'custom'>) => {
    const dates = presetDates(value)
    setPreset(value)
    setFromDate(dates.fromDate)
    setToDate(dates.toDate)
  }

  const applyFilters = () => {
    if (!fromDate || !toDate || fromDate > toDate) {
      setFilterError('Geçerli bir başlangıç ve bitiş tarihi seçin.')
      return
    }
    if (inclusiveCalendarDayCount(fromDate, toDate) > 366) {
      setFilterError('Tarih aralığı en fazla 366 gün olabilir.')
      return
    }
    setFilterError('')
    setAiInsight(null)
    setAiError('')
    setAppliedFilters({
      propertyId: propertyId === 'all' ? undefined : propertyId,
      buildingId: buildingId === 'all' ? undefined : buildingId,
      fromDate,
      toDate,
    })
  }

  const generateAiInsight = async () => {
    if (isAiLoading || isLoading || hasUnappliedFilters || !finance || !maintenance || !facilities) return

    setIsAiLoading(true)
    setAiError('')
    setAiInsight(null)
    const requestVersion = ++aiRequestVersionRef.current
    try {
      const insight = await generateAnalyticsAiInsight(appliedFilters)
      if (requestVersion === aiRequestVersionRef.current) setAiInsight(insight)
    } catch (insightError) {
      if (requestVersion === aiRequestVersionRef.current) {
        setAiError(insightError instanceof Error
          ? insightError.message
          : 'AI içgörüsü şu anda oluşturulamıyor. Analiz verilerini kullanmaya devam edebilirsiniz.')
      }
    } finally {
      if (requestVersion === aiRequestVersionRef.current) setIsAiLoading(false)
    }
  }

  return (
    <div className="management-page analytics-page">
      <PageHeader
        eyebrow="Yönetim Paneli"
        title="Operasyonel Analizler"
        subtitle="Finans, bakım ve ortak alan kullanımını yetki kapsamınız içinde birlikte değerlendirin."
        meta={`${appliedFilters.fromDate} — ${appliedFilters.toDate}`}
      />

      <section className="panel analytics-filter-panel" aria-label="Analytics filtreleri">
        <div className="form-field"><label htmlFor="analytics-property">Yapı</label><select id="analytics-property" value={propertyId} onChange={(event) => { setPropertyId(event.target.value === 'all' ? 'all' : Number(event.target.value)); setBuildingId('all') }}><option value="all">Tüm erişilebilir yapılar</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="form-field"><label htmlFor="analytics-building">Blok / Bina</label><select id="analytics-building" value={buildingId} disabled={propertyId === 'all'} onChange={(event) => setBuildingId(event.target.value === 'all' ? 'all' : Number(event.target.value))}><option value="all">{propertyId === 'all' ? 'Önce yapı seçin' : 'Tüm erişilebilir bloklar'}</option>{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="form-field analytics-preset-field"><span className="analytics-field-label">Tarih Aralığı</span><div className="analytics-presets" role="group" aria-label="Tarih aralığı hazır seçimleri">{([['30d', 'Son 30 Gün'], ['month', 'Bu Ay'], ['3m', 'Son 3 Ay'], ['year', 'Bu Yıl']] as const).map(([value, label]) => <button key={value} className={preset === value ? 'active' : ''} type="button" aria-pressed={preset === value} onClick={() => selectPreset(value)}>{label}</button>)}</div></div>
        <div className="form-field"><label htmlFor="analytics-from">Başlangıç</label><input id="analytics-from" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPreset('custom') }} /></div>
        <div className="form-field"><label htmlFor="analytics-to">Bitiş</label><input id="analytics-to" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPreset('custom') }} /></div>
        <button className="primary-button analytics-apply-button" type="button" disabled={isLoading} onClick={applyFilters}>Uygula</button>
        {filterError && <p className="status-message error-message analytics-filter-error" role="alert">{filterError}</p>}
        <p className="analytics-comparison-note">Karşılaştırmalar, seçilen tarih aralığından hemen önceki eşit uzunluktaki dönemle yapılır.</p>
      </section>

      <section className="panel analytics-ai-panel" aria-labelledby="analytics-ai-title">
        <div className="analytics-ai-heading">
          <div>
            <p className="eyebrow">İsteğe Bağlı AI Desteği</p>
            <h2 id="analytics-ai-title">Operasyonel içgörü</h2>
            <p>Yalnızca ekrandaki yetkili kapsam ve tarih aralığına ait toplu veriler değerlendirilir.</p>
          </div>
          <button
            className="primary-button compact-button"
            type="button"
            disabled={isAiLoading || isLoading || hasUnappliedFilters || Boolean(error) || !finance || !maintenance || !facilities}
            onClick={() => void generateAiInsight()}
          >
            {isAiLoading ? 'İçgörü hazırlanıyor...' : 'AI İçgörüsü Oluştur'}
          </button>
        </div>
        {hasUnappliedFilters && <p className="analytics-ai-note">İçgörü oluşturmadan önce filtre değişikliklerini uygulayın.</p>}
        {aiError && <p className="status-message info-message analytics-ai-message" role="status">{aiError}</p>}
        {aiInsight && (
          <div className="analytics-ai-result" role="status">
            <p>{aiInsight.summary}</p>
            <div className="analytics-ai-lists">
              <div>
                <h3>Öne çıkanlar</h3>
                <ul>{aiInsight.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              {aiInsight.attentionPoints.length > 0 && (
                <div>
                  <h3>Dikkat noktaları</h3>
                  <ul>{aiInsight.attentionPoints.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )}
            </div>
            <small>{new Date(aiInsight.generatedAt).toLocaleString('tr-TR')} tarihinde oluşturuldu.</small>
            {!aiInsight.aiEnhanced && (
              <small>AI sağlayıcısı kullanılamadığı için doğrulanmış analiz bulguları gösteriliyor.</small>
            )}
          </div>
        )}
      </section>

      {isLoading ? <LoadingSkeleton variant="dashboard" /> : error ? (
        <section className="panel entity-state-panel error-state" role="alert"><p className="status-message error-message">{error}</p><button className="secondary-button" type="button" onClick={() => void loadAnalytics()}>Tekrar Dene</button></section>
      ) : finance && maintenance && facilities && (
        <div className="analytics-sections">
          <section className="analytics-domain-section" aria-labelledby="finance-analytics-title">
            <div className="section-heading"><p className="eyebrow">Finans</p><h2 id="finance-analytics-title">Finansal görünüm</h2><p>Tahsilat seçili dönemde alınan ödemeyi; tahsilat oranı ise bu dönemde vadelenen tahakkukların dönem sonundaki kapanma düzeyini gösterir.</p></div>
            <div className="analytics-metric-grid">
              <MetricCard label="Tahakkuk" value={formatCurrency(finance.totalCharged)} comparison={finance.totalAssessedComparison} />
              <MetricCard label="Tahsilat" value={formatCurrency(finance.totalCollected)} hint="Dönemde alınan ödeme" comparison={finance.totalCollectedComparison} />
              <MetricCard label="Kalan Borç" value={formatCurrency(finance.outstandingAmount)} hint="Dönem tahakkuklarından" />
              <MetricCard label="Tahsilat Oranı" value={`%${finance.collectionRate.toLocaleString('tr-TR')}`} />
              <MetricCard label="Gecikmiş" value={formatCurrency(finance.overdueAmount)} hint={`${finance.overdueChargeCount} tahakkuk`} />
              <MetricCard label="Gider" value={formatCurrency(finance.totalExpenses)} comparison={finance.totalExpensesComparison} />
              <MetricCard label="Net Nakit Hareketi" value={formatCurrency(finance.netCashPosition)} hint="Tahsilat − gider" />
            </div>
            <div className="analytics-chart-grid">
              <TrendBars title="Aylık tahakkuk ve tahsilat" primaryLabel="Tahakkuk" secondaryLabel="Tahsilat" points={finance.trend.map((item) => ({ key: item.period, primary: item.charged, secondary: item.collected }))} />
              <HorizontalBars title="Gider kategorileri" items={finance.expenseByCategory.map((item) => ({ key: item.key, label: EXPENSE_LABELS[item.key] ?? item.key, value: item.amount, display: formatCurrency(item.amount) }))} />
              <HorizontalBars title="Bloklara göre kalan borç" items={finance.outstandingByBuilding.map((item) => ({ key: String(item.buildingId), label: item.buildingName, value: item.amount, display: formatCurrency(item.amount) }))} />
            </div>
          </section>

          <section className="analytics-domain-section" aria-labelledby="maintenance-analytics-title">
            <div className="section-heading"><p className="eyebrow">Bakım</p><h2 id="maintenance-analytics-title">Talep performansı</h2><p>Seçili dönemde oluşturulan bakım ve arıza taleplerinin güncel dağılımı.</p></div>
            <div className="analytics-metric-grid compact">
              <MetricCard label="Toplam Talep" value={maintenance.totalRequests} comparison={maintenance.totalRequestsComparison} />
              <MetricCard label="Açık" value={maintenance.openBacklog} />
              <MetricCard label="İşlemde" value={maintenance.inProgress} />
              <MetricCard label="Çözülen / Kapanan" value={maintenance.resolvedOrClosed} />
              <MetricCard label="Yüksek / Acil" value={maintenance.highOrEmergency} />
              <MetricCard label="Ort. Çözüm Süresi" value={maintenance.averageResolutionHours === null ? '—' : `${maintenance.averageResolutionHours} saat`} comparison={maintenance.averageResolutionHoursComparison} />
            </div>
            <div className="analytics-chart-grid">
              <TrendBars title="Günlük talep trendi" points={maintenance.trend.map((item) => ({ key: item.period, primary: item.count }))} />
              <HorizontalBars title="Kategori dağılımı" items={maintenance.byCategory.map((item) => ({ key: item.key, label: CATEGORY_LABELS[item.key] ?? item.key, value: item.count, display: String(item.count) }))} />
              <HorizontalBars title="Durum dağılımı" items={maintenance.byStatus.map((item) => ({ key: item.key, label: STATUS_LABELS[item.key] ?? item.key, value: item.count, display: String(item.count) }))} />
              <HorizontalBars title="En çok talep gelen bloklar" items={maintenance.topBuildings.map((item) => ({ key: String(item.buildingId), label: item.buildingName, value: item.count, display: String(item.count) }))} />
            </div>
          </section>

          <section className="analytics-domain-section" aria-labelledby="facility-analytics-title">
            <div className="section-heading"><p className="eyebrow">Ortak Alanlar</p><h2 id="facility-analytics-title">Rezervasyon kullanımı</h2><p>Seçili başlangıç tarih aralığındaki rezervasyon sayıları ve onaylı/tamamlanmış rezerve saatler.</p></div>
            <div className="analytics-metric-grid compact">
              <MetricCard label="Toplam Rezervasyon" value={facilities.totalReservations} comparison={facilities.totalReservationsComparison} />
              <MetricCard label="Onaylı / Tamamlanan" value={facilities.approvedOrCompleted} />
              <MetricCard label="Bekleyen" value={facilities.pending} />
              <MetricCard label="İptal / Red" value={facilities.cancelledOrRejected} />
              <MetricCard label="Rezerve Saat" value={`${facilities.bookedHours} saat`} hint="Onaylı ve tamamlanan" comparison={facilities.bookedHoursComparison} />
            </div>
            <div className="analytics-chart-grid">
              <TrendBars title="Günlük rezervasyon trendi" points={facilities.trend.map((item) => ({ key: item.period, primary: item.count }))} />
              <HorizontalBars title="Tesise göre rezervasyon" items={facilities.byFacility.map((item) => ({ key: String(item.facilityId), label: item.facilityName, value: item.reservationCount, display: `${item.reservationCount} · ${item.bookedHours} saat` }))} />
              <HorizontalBars title="Rezervasyon durumları" items={facilities.byStatus.map((item) => ({ key: item.key, label: STATUS_LABELS[item.key] ?? item.key, value: item.count, display: String(item.count) }))} />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
