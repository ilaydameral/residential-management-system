import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnnouncementTextImprovement } from '../types'
import { deferred } from './deferred'

const api = vi.hoisted(() => ({
  getAnnouncements: vi.fn(), getAnnouncement: vi.fn(), createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(), publishAnnouncement: vi.fn(), cancelAnnouncement: vi.fn(),
  improveAnnouncementText: vi.fn(), getProperties: vi.fn(), getBuildingsByProperty: vi.fn(),
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

import { AnnouncementManagement } from '../components/AnnouncementManagement'

async function openAnnouncementForm() {
  const user = userEvent.setup()
  render(<MemoryRouter><AnnouncementManagement /></MemoryRouter>)
  const buttons = await screen.findAllByRole('button', { name: 'Yeni Duyuru' })
  await user.click(buttons[0])
  await user.type(screen.getByLabelText('Başlık *'), 'Su kesintisi')
  await user.type(screen.getByLabelText('İçerik *'), 'Yarın planlı su kesintisi yapılacaktır.')
  return user
}

describe('announcement AI assistance', () => {
  beforeEach(() => {
    api.getAnnouncements.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 15 })
    api.getProperties.mockResolvedValue([{ id: 1, name: 'Site', isActive: true }])
    api.getBuildingsByProperty.mockResolvedValue([])
  })

  it('keeps announcement content manually editable without AI', async () => {
    const user = await openAnnouncementForm()
    const content = screen.getByLabelText('İçerik *') as HTMLTextAreaElement

    await user.type(content, ' Ek bilgi daha sonra paylaşılacaktır.')

    expect(content.value).toContain('Ek bilgi daha sonra paylaşılacaktır.')
    expect(api.improveAnnouncementText).not.toHaveBeenCalled()
    expect(api.createAnnouncement).not.toHaveBeenCalled()
    expect(api.publishAnnouncement).not.toHaveBeenCalled()
  })

  it('ignores stale AI text when the announcement changes', async () => {
    const pending = deferred<AnnouncementTextImprovement>()
    api.improveAnnouncementText.mockReturnValue(pending.promise)
    const user = await openAnnouncementForm()
    await user.click(screen.getByRole('button', { name: 'AI ile Metni İyileştir' }))
    await user.type(screen.getByLabelText('İçerik *'), ' Güncellendi.')
    pending.resolve({ improvedText: 'Eski duyuru sonucu', generatedAt: '2026-01-01T00:00:00Z' })
    await waitFor(() => expect(screen.queryByText('Eski duyuru sonucu')).not.toBeInTheDocument())
  })

  it('requires Apply, never auto-creates or publishes, and remains manually editable', async () => {
    api.improveAnnouncementText.mockResolvedValue({
      improvedText: 'Planlı su kesintisi yarın uygulanacaktır.', generatedAt: '2026-01-01T00:00:00Z',
    })
    const user = await openAnnouncementForm()
    const content = screen.getByLabelText('İçerik *') as HTMLTextAreaElement
    const original = content.value
    await user.click(screen.getByRole('button', { name: 'AI ile Metni İyileştir' }))
    expect(await screen.findByText('Planlı su kesintisi yarın uygulanacaktır.')).toBeInTheDocument()
    expect(content.value).toBe(original)
    expect(api.createAnnouncement).not.toHaveBeenCalled()
    expect(api.publishAnnouncement).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Metne Uygula' }))
    expect(content.value).toBe('Planlı su kesintisi yarın uygulanacaktır.')
    await user.type(content, ' Ek bilgi.')
    expect(content.value).toContain('Ek bilgi.')
    expect(api.createAnnouncement).not.toHaveBeenCalled()
    expect(api.publishAnnouncement).not.toHaveBeenCalled()
  })
})
