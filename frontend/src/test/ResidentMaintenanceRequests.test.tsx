import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaintenanceAiSuggestion, MaintenanceDescriptionImprovement, MaintenanceImageAnalysis } from '../types'
import { deferred } from './deferred'

const api = vi.hoisted(() => ({
  analyzeMaintenanceImage: vi.fn(),
  cancelResidentMaintenanceRequest: vi.fn(),
  createResidentMaintenanceRequest: vi.fn(),
  getMaintenanceAiSuggestion: vi.fn(),
  improveMaintenanceDescription: vi.fn(),
  getMyUnits: vi.fn(),
  getResidentMaintenanceRequest: vi.fn(),
  getResidentMaintenanceRequestAttachmentFile: vi.fn(),
  getResidentMaintenanceRequests: vi.fn(),
  resolveActionResidentMaintenanceRequest: vi.fn(),
  uploadResidentMaintenanceRequestAttachment: vi.fn(),
}))

vi.mock('../api', () => api)
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../hooks/useAnimatedDrawer', () => ({
  useAnimatedDrawer: (isOpen: boolean) => ({ shouldRender: isOpen, phase: 'open' }),
}))
vi.mock('../hooks/useDrawerAccessibility', () => ({ useDrawerAccessibility: () => ({ current: null }) }))
vi.mock('../hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({ requestDiscard: async () => true, unsavedChangesDialog: null }),
}))
vi.mock('../realtime/useRealtimeMaintenance', () => ({ useRealtimeMaintenance: () => undefined }))

import { ResidentMaintenanceRequests } from '../components/ResidentMaintenanceRequests'

async function openForm() {
  const user = userEvent.setup()
  render(<MemoryRouter><ResidentMaintenanceRequests /></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: 'Yeni Talep' }))
  await user.type(screen.getByLabelText('Konu / Başlık *'), 'Musluk sorunu')
  await user.type(screen.getByLabelText('Açıklama *'), 'Mutfak musluğundan sürekli su akıyor.')
  return user
}

describe('resident maintenance AI remains advisory and stale-safe', () => {
  beforeEach(() => {
    api.getResidentMaintenanceRequests.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 })
    api.getMyUnits.mockResolvedValue([{
      unitId: 10, propertyName: 'Site', buildingName: 'A Blok', unitNumber: '1', floorNumber: 1,
      unitTypeName: 'Daire', grossArea: null, netArea: null, occupancyType: 'TENANT', isPrimary: true,
      startDate: '2026-01-01T00:00:00Z',
    }])
  })

  it('keeps title, description, category, and priority manually controllable without AI', async () => {
    const user = await openForm()
    const title = screen.getByLabelText('Konu / Başlık *') as HTMLInputElement
    const description = screen.getByLabelText('Açıklama *') as HTMLTextAreaElement
    const category = screen.getByLabelText('Kategori *') as HTMLSelectElement
    const priority = screen.getByLabelText('Öncelik *') as HTMLSelectElement

    await user.clear(title)
    await user.type(title, 'Asansör kapısı kapanmıyor')
    await user.clear(description)
    await user.type(description, 'Kapı üçüncü katta açık kalıyor.')
    await user.selectOptions(category, 'ELEVATOR')
    await user.selectOptions(priority, 'HIGH')

    expect(title.value).toBe('Asansör kapısı kapanmıyor')
    expect(description.value).toBe('Kapı üçüncü katta açık kalıyor.')
    expect(category.value).toBe('ELEVATOR')
    expect(priority.value).toBe('HIGH')
    expect(api.getMaintenanceAiSuggestion).not.toHaveBeenCalled()
    expect(api.createResidentMaintenanceRequest).not.toHaveBeenCalled()
  })

  it('ignores a stale classification after title changes', async () => {
    const pending = deferred<MaintenanceAiSuggestion>()
    api.getMaintenanceAiSuggestion.mockReturnValue(pending.promise)
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: 'AI ile Öner' }))
    await user.type(screen.getByLabelText('Konu / Başlık *'), ' güncel')
    pending.resolve({ suggestedCategory: 'ELECTRICAL', suggestedPriority: 'HIGH', confidence: 0.8, explanation: 'Eski sonuç', warnings: [] })
    await waitFor(() => expect(screen.queryByText('Eski sonuç')).not.toBeInTheDocument())
  })

  it('ignores a stale description improvement after manual editing', async () => {
    const pending = deferred<MaintenanceDescriptionImprovement>()
    api.improveMaintenanceDescription.mockReturnValue(pending.promise)
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: 'AI ile Açıklamayı İyileştir' }))
    await user.type(screen.getByLabelText('Açıklama *'), ' Yeni bilgi.')
    pending.resolve({ improvedDescription: 'Eski açıklama önerisi', generatedAt: '2026-01-01T00:00:00Z' })
    await waitFor(() => expect(screen.queryByText('Eski açıklama önerisi')).not.toBeInTheDocument())
  })

  it('aborts and ignores stale vision analysis after form changes', async () => {
    const pending = deferred<MaintenanceImageAnalysis>()
    api.analyzeMaintenanceImage.mockReturnValue(pending.promise)
    const user = await openForm()
    const image = new File(['image'], 'leak.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Dosya Seç'), image)
    await user.click(screen.getByRole('button', { name: 'AI ile Görseli Analiz Et' }))
    await user.type(screen.getByLabelText('Açıklama *'), ' değişti')
    pending.resolve({ observation: 'Eski görsel sonucu', suggestedCategory: 'PLUMBING', suggestedPriority: 'HIGH', confidence: 0.9, warnings: [], generatedAt: '2026-01-01T00:00:00Z' })
    await waitFor(() => expect(screen.queryByText('Eski görsel sonucu')).not.toBeInTheDocument())
  })

  it('applies classification only on request and keeps manual form control', async () => {
    api.getMaintenanceAiSuggestion.mockResolvedValue({
      suggestedCategory: 'ELECTRICAL', suggestedPriority: 'HIGH', confidence: 0.8,
      explanation: 'Elektrik kontrolü önerilir.', warnings: [],
    })
    const user = await openForm()
    const category = screen.getByLabelText('Kategori *') as HTMLSelectElement
    const priority = screen.getByLabelText('Öncelik *') as HTMLSelectElement
    await user.click(screen.getByRole('button', { name: 'AI ile Öner' }))
    expect(await screen.findByText('Elektrik kontrolü önerilir.')).toBeInTheDocument()
    expect(category.value).toBe('PLUMBING')
    expect(priority.value).toBe('NORMAL')
    expect(api.createResidentMaintenanceRequest).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Öneriyi Uygula' }))
    expect(category.value).toBe('ELECTRICAL')
    expect(priority.value).toBe('HIGH')
    await user.selectOptions(priority, 'LOW')
    expect(priority.value).toBe('LOW')
    expect(api.createResidentMaintenanceRequest).not.toHaveBeenCalled()
  })

  it('ignores an advisory suggestion without changing manual values', async () => {
    api.getMaintenanceAiSuggestion.mockResolvedValue({
      suggestedCategory: 'ELECTRICAL', suggestedPriority: 'HIGH', confidence: null,
      explanation: 'Öneri', warnings: [],
    })
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: 'AI ile Öner' }))
    await user.click(await screen.findByRole('button', { name: 'Yoksay' }))
    expect((screen.getByLabelText('Kategori *') as HTMLSelectElement).value).toBe('PLUMBING')
    expect((screen.getByLabelText('Öncelik *') as HTMLSelectElement).value).toBe('NORMAL')
  })
})
