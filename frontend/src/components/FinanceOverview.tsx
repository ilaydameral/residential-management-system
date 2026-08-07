import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getHighestOutstandingUnits,
  getManagementFinanceSummary,
  getMonthlyCollectionSummary,
} from '../api'
import { LoadingSkeleton } from './LoadingSkeleton'
import type {
  ManagementFinanceSummaryDto,
  MonthlyCollectionSummaryDto,
  UnitOutstandingReportDto,
} from '../types'

type PeriodRange = '6M' | '12M' | '24M'

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '0,00 ₺'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatRate(rate: number): string {
  return `%${rate.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function FinanceOverview() {
  const navigate = useNavigate()

  // Summary State
  const [summary, setSummary] = useState<ManagementFinanceSummaryDto | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')

  // Monthly Collections State
  const [monthlyCollections, setMonthlyCollections] = useState<MonthlyCollectionSummaryDto[]>([])
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(true)
  const [monthlyError, setMonthlyError] = useState('')

  // Outstanding Units State
  const [outstandingUnits, setOutstandingUnits] = useState<UnitOutstandingReportDto[]>([])
  const [isUnitsLoading, setIsUnitsLoading] = useState(true)
  const [unitsError, setUnitsError] = useState('')

  // Selected period range filter (default: 12M)
  const [periodRange, setPeriodRange] = useState<PeriodRange>('12M')

  // Last refresh timestamp
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchSummary = useCallback(async () => {
    setIsSummaryLoading(true)
    setSummaryError('')
    try {
      const data = await getManagementFinanceSummary()
      setSummary(data)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Finansal özet bilgileri yüklenemedi.')
    } finally {
      setIsSummaryLoading(false)
    }
  }, [])

  const fetchMonthly = useCallback(async () => {
    setIsMonthlyLoading(true)
    setMonthlyError('')
    try {
      const data = await getMonthlyCollectionSummary()
      setMonthlyCollections(data)
    } catch (err) {
      setMonthlyError(err instanceof Error ? err.message : 'Aylık tahsilat verileri yüklenemedi.')
    } finally {
      setIsMonthlyLoading(false)
    }
  }, [])

  const fetchUnits = useCallback(async () => {
    setIsUnitsLoading(true)
    setUnitsError('')
    try {
      const data = await getHighestOutstandingUnits(10)
      setOutstandingUnits(data)
    } catch (err) {
      setUnitsError(err instanceof Error ? err.message : 'Borçlu daireler listesi yüklenemedi.')
    } finally {
      setIsUnitsLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([fetchSummary(), fetchMonthly(), fetchUnits()])
    setLastRefreshedAt(new Date())
    setIsRefreshing(false)
  }, [fetchSummary, fetchMonthly, fetchUnits])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  // Group outstanding units by unitId to eliminate duplicate unit rows in UI
  const uniqueOutstandingUnits = useMemo(() => {
    const map = new Map<number, UnitOutstandingReportDto>()
    for (const item of outstandingUnits) {
      const existing = map.get(item.unitId)
      if (!existing) {
        map.set(item.unitId, { ...item })
      } else {
        existing.totalCharged += item.totalCharged
        existing.totalPaid += item.totalPaid
        existing.remainingBalance += item.remainingBalance
        existing.overdueChargeCount += item.overdueChargeCount
      }
    }
    return Array.from(map.values())
      .filter((u) => u.remainingBalance > 0)
      .sort((a, b) => b.remainingBalance - a.remainingBalance)
      .slice(0, 5)
  }, [outstandingUnits])

  // Filter months based on selected periodRange (6M vs 12M vs 24M)
  const displayedMonths = useMemo(() => {
    if (!monthlyCollections || monthlyCollections.length === 0) return []
    if (periodRange === '6M') {
      return monthlyCollections.slice(-6)
    }
    // Default 12M
    return monthlyCollections
  }, [monthlyCollections, periodRange])

  // Max amount across displayed months to scale dual bars proportionally
  const maxMonthAmount = useMemo(() => {
    if (!displayedMonths || displayedMonths.length === 0) return 1
    return Math.max(...displayedMonths.map((m) => Math.max(m.totalCharged, m.totalCollected)), 1)
  }, [displayedMonths])

  return (
    <div className="finance-overview">
      {/* Top Header Actions Bar */}
      <div className="finance-top-bar">
        <span className="finance-last-updated">
          Son Güncelleme: {formatTime(lastRefreshedAt)}
        </span>
        <button
          type="button"
          className="secondary-button finance-refresh-btn"
          onClick={() => { void refreshAll() }}
          disabled={isRefreshing || isSummaryLoading}
        >
          <span className={`finance-refresh-icon ${isRefreshing ? 'spinning' : ''}`}>↻</span>
          <span>{isRefreshing ? 'Yenileniyor...' : 'Yenile'}</span>
        </button>
      </div>

      {/* 4 Summary Cards Grid */}
      {isSummaryLoading ? (
        <LoadingSkeleton variant="dashboard" />
      ) : summaryError ? (
        <div className="panel status-message error-message">
          <p>{summaryError}</p>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: '8px' }}
            onClick={() => { void fetchSummary() }}
          >
            Tekrar Dene
          </button>
        </div>
      ) : summary ? (
        <div className="finance-summary-grid">
          {/* Toplam Tahakkuk */}
          <div className="finance-summary-card accent-charged">
            <div className="finance-card-header">
              <span className="finance-card-label">Toplam Tahakkuk</span>
              <div className="finance-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="finance-card-value">
              {formatCurrency(summary.totalCharged)}
            </div>
            <div className="finance-card-subtext">
              {summary.totalUnitsCount} aktif bağımsız bölüm
            </div>
          </div>

          {/* Tahsil Edilen */}
          <div className="finance-summary-card accent-success">
            <div className="finance-card-header">
              <span className="finance-card-label">Tahsil Edilen</span>
              <div className="finance-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="finance-card-value">
              {formatCurrency(summary.totalPaid)}
            </div>
            <div className="finance-card-subtext">
              Onaylanmış ödemeler
            </div>
          </div>

          {/* Kalan Alacak */}
          <div className="finance-summary-card accent-info">
            <div className="finance-card-header">
              <span className="finance-card-label">Kalan Alacak</span>
              <div className="finance-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="finance-card-value">
              {formatCurrency(summary.totalOutstanding)}
            </div>
            <div className="finance-card-subtext">
              Tahsil edilecek bakiye
            </div>
          </div>

          {/* Gecikmiş Tutar */}
          <div className={`finance-summary-card accent-danger ${summary.overdueAmount > 0 ? 'has-overdue' : ''}`}>
            <div className="finance-card-header">
              <span className="finance-card-label">Gecikmiş Tutar</span>
              <div className="finance-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="finance-card-value">
              {formatCurrency(summary.overdueAmount)}
            </div>
            <div className="finance-card-subtext">
              {summary.overdueUnitCount} dairede vadesi geçmiş
            </div>
          </div>
        </div>
      ) : null}

      {/* Middle Section: Dual Bar Chart Container with Legend and Segmented Control */}
      <div className="panel finance-chart-panel">
        <div className="finance-panel-header">
          <div className="finance-panel-title-area">
            <h2>Tahakkuk ve Tahsilat Gerçekleşmesi</h2>
            <p>Aylık bazda gerçekleşen borçlandırmalar ve tahsilatlar</p>
          </div>

          <div className="finance-panel-header-right">
            {/* Chart Legend */}
            <div className="finance-chart-legend" aria-label="Grafik renk göstergesi">
              <span className="finance-legend-item">
                <span className="finance-legend-dot dot-charged" />
                <span>Tahakkuk</span>
              </span>
              <span className="finance-legend-item">
                <span className="finance-legend-dot dot-collected" />
                <span>Tahsilat</span>
              </span>
            </div>

            {/* Segmented Period Filter */}
            <div className="finance-segmented-control" role="group" aria-label="Zaman aralığı seçin">
              <button
                type="button"
                className={`finance-segment-btn ${periodRange === '6M' ? 'active' : ''}`}
                onClick={() => setPeriodRange('6M')}
              >
                6 Ay
              </button>
              <button
                type="button"
                className={`finance-segment-btn ${periodRange === '12M' ? 'active' : ''}`}
                onClick={() => setPeriodRange('12M')}
              >
                12 Ay
              </button>
              <button
                type="button"
                className="finance-segment-btn disabled"
                disabled
                title="Yakında (Backend 24 ay desteği gerekmektedir)"
              >
                24 Ay
              </button>
            </div>
          </div>
        </div>

        {isMonthlyLoading ? (
          <LoadingSkeleton variant="table" rows={2} />
        ) : monthlyError ? (
          <div className="status-message error-message">{monthlyError}</div>
        ) : displayedMonths.length === 0 ? (
          <div className="status-message" style={{ textAlign: 'center' }}>
            Henüz tahakkuk verisi bulunmuyor.
          </div>
        ) : (
          <div className={`finance-dynamic-chart cols-${displayedMonths.length}`}>
            {displayedMonths.map((m) => {
              const rate = m.collectionPercentage
              const hasData = m.totalCharged > 0

              let rateStyle = 'rate-zero'
              if (hasData) {
                if (rate >= 80) rateStyle = 'rate-high'
                else if (rate >= 50) rateStyle = 'rate-mid'
                else rateStyle = 'rate-low'
              }

              // Proportional heights relative to maxMonthAmount
              const chargedHeightPercent = hasData
                ? Math.max((m.totalCharged / maxMonthAmount) * 100, 4)
                : 0
              const collectedHeightPercent = hasData
                ? Math.max((m.totalCollected / maxMonthAmount) * 100, m.totalCollected > 0 ? 4 : 0)
                : 0

              return (
                <div
                  key={`${m.year}-${m.month}`}
                  className={`finance-chart-col ${hasData ? 'has-data' : 'no-data'}`}
                >
                  <div className="finance-chart-col-header" title={m.periodName}>
                    {m.periodName}
                  </div>

                  {/* Dual Vertical Bars Track */}
                  <div className="finance-chart-dual-track">
                    {/* Tahakkuk Barı */}
                    <div
                      className="finance-bar-single bar-charged"
                      style={{ height: `${chargedHeightPercent}%` }}
                      title={`Tahakkuk: ${formatCurrency(m.totalCharged)}`}
                    />
                    {/* Tahsilat Barı */}
                    <div
                      className="finance-bar-single bar-collected"
                      style={{ height: `${collectedHeightPercent}%` }}
                      title={`Tahsilat: ${formatCurrency(m.totalCollected)}`}
                    />
                  </div>

                  <div className="finance-chart-col-footer">
                    <span className={`finance-chart-rate ${rateStyle}`}>
                      {hasData ? formatRate(rate) : '—'}
                    </span>
                    <span className="finance-chart-collected" title={`Tahsilat: ${formatCurrency(m.totalCollected)}`}>
                      {hasData ? formatCurrency(m.totalCollected) : 'Veri Yok'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Section: 2 Columns 70% - 30% */}
      <div className="finance-bottom-grid">
        {/* Left Column: Top Outstanding Units (70%) */}
        <div className="panel finance-outstanding-panel">
          <div className="finance-card-title-block">
            <h2>En Yüksek Borçlu Daireler</h2>
            <p>Ödenmemiş bakiyesi en yüksek bağımsız bölümler</p>
          </div>

          {isUnitsLoading ? (
            <LoadingSkeleton variant="table" rows={3} />
          ) : unitsError ? (
            <div className="status-message error-message">{unitsError}</div>
          ) : uniqueOutstandingUnits.length === 0 ? (
            <div className="status-message" style={{ textAlign: 'center', marginTop: '8px' }}>
              Kalan borcu bulunan daire bulunmuyor.
            </div>
          ) : (
            <div className="finance-table-wrapper">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Daire / Bağımsız Bölüm</th>
                    <th>Yapı ve Blok</th>
                    <th className="text-right">Tahakkuk</th>
                    <th className="text-right">Ödenen</th>
                    <th className="text-right">Kalan Borç</th>
                  </tr>
                </thead>
                <tbody>
                  {uniqueOutstandingUnits.map((u) => (
                    <tr key={u.unitId}>
                      <td>
                        <div className="finance-unit-title">Daire {u.unitNumber}</div>
                      </td>
                      <td>
                        <div className="finance-unit-subtitle">{u.propertyName} · {u.buildingName}</div>
                      </td>
                      <td className="text-right">{formatCurrency(u.totalCharged)}</td>
                      <td className="text-right" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                        {formatCurrency(u.totalPaid)}
                      </td>
                      <td className="text-right">
                        <span className="finance-remaining-badge">
                          {formatCurrency(u.remainingBalance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Pending Submissions Card (30%, Compact & Top-Aligned) */}
        <div className="panel finance-pending-card">
          <div className="finance-card-title-block">
            <h2>Dekont İnceleme Merkezi</h2>
            <p>Sakinlerden gelen ödeme başvuruları</p>
          </div>

          <div className="finance-pending-direct-info">
            <div className="finance-pending-big-count">
              {summary?.pendingSubmissionCount ?? 0} Adet
            </div>
            <p className="finance-pending-direct-text">
              İnceleme ve onay bekleyen ödeme dekontu başvurusu bulunmaktadır.
            </p>
          </div>

          <button
            type="button"
            className="primary-button finance-cta-btn"
            onClick={() => { navigate('/management/finance/payment-submissions') }}
          >
            <span>Başvuruları İncele →</span>
          </button>
        </div>
      </div>
    </div>
  )
}
