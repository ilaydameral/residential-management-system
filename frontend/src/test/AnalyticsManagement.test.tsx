import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyticsAiInsight } from '../types'
import { deferred } from './deferred'

const api = vi.hoisted(() => ({
  getBuildingsByProperty: vi.fn(), getFacilityAnalytics: vi.fn(), getFinanceAnalytics: vi.fn(),
  getMaintenanceAnalytics: vi.fn(), getProperties: vi.fn(), generateAnalyticsAiInsight: vi.fn(),
}))
vi.mock('../api', () => api)

import { AnalyticsManagement } from '../components/AnalyticsManagement'

const comparison = { currentValue: 0, previousValue: 0, percentageChange: null }
const finance = {
  fromDate: '', toDate: '', totalCharged: 0, totalCollected: 0, outstandingAmount: 0,
  collectionRate: 0, overdueChargeCount: 0, overdueAmount: 0, totalExpenses: 0, netCashPosition: 0,
  totalAssessedComparison: comparison, totalCollectedComparison: comparison, totalExpensesComparison: comparison,
  trend: [], expenseByCategory: [], outstandingByBuilding: [],
}
const maintenance = {
  fromDate: '', toDate: '', totalRequests: 0, openBacklog: 0, inProgress: 0, resolvedOrClosed: 0,
  highOrEmergency: 0, averageResolutionHours: null, totalRequestsComparison: comparison,
  averageResolutionHoursComparison: comparison, byCategory: [], byStatus: [], trend: [], topBuildings: [],
}
const facilities = {
  fromDate: '', toDate: '', totalReservations: 0, approvedOrCompleted: 0, pending: 0,
  cancelledOrRejected: 0, bookedHours: 0, totalReservationsComparison: comparison,
  bookedHoursComparison: comparison, byFacility: [], byStatus: [], trend: [],
}

describe('analytics remains useful without AI and rejects stale insight', () => {
  beforeEach(() => {
    api.getProperties.mockResolvedValue([])
    api.getBuildingsByProperty.mockResolvedValue([])
    api.getFinanceAnalytics.mockResolvedValue(finance)
    api.getMaintenanceAnalytics.mockResolvedValue(maintenance)
    api.getFacilityAnalytics.mockResolvedValue(facilities)
  })

  it('ignores an in-flight insight after filters change', async () => {
    const pending = deferred<AnalyticsAiInsight>()
    api.generateAnalyticsAiInsight.mockReturnValue(pending.promise)
    const user = userEvent.setup()
    render(<AnalyticsManagement />)
    await screen.findByText('Finansal görünüm')
    await user.click(screen.getByRole('button', { name: 'AI İçgörüsü Oluştur' }))
    await user.type(screen.getByLabelText('Başlangıç'), '2026-01-01')
    pending.resolve({ summary: 'Eski filtre içgörüsü', highlights: [], attentionPoints: [], aiEnhanced: true, generatedAt: '2026-01-01T00:00:00Z' })
    await waitFor(() => expect(screen.queryByText('Eski filtre içgörüsü')).not.toBeInTheDocument())
  })

  it('keeps core analytics rendered when optional AI fails', async () => {
    api.generateAnalyticsAiInsight.mockRejectedValue(new Error('AI şu anda kullanılamıyor.'))
    const user = userEvent.setup()
    render(<AnalyticsManagement />)
    expect(await screen.findByText('Finansal görünüm')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'AI İçgörüsü Oluştur' }))
    expect(await screen.findByText('AI şu anda kullanılamıyor.')).toBeInTheDocument()
    expect(screen.getByText('Finansal görünüm')).toBeInTheDocument()
    expect(screen.getByText('Talep performansı')).toBeInTheDocument()
  })
})
