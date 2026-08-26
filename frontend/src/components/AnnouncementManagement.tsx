import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  cancelAnnouncement,
  getProperties,
  getBuildingsByProperty,
} from '../api'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import type {
  AnnouncementDto,
  Building,
  CreateAnnouncementPayload,
  Property,
} from '../types'

const PRIORITY_LABEL_MAP: Record<string, { label: string; className: string }> = {
  NORMAL: { label: 'Normal', className: 'badge-secondary' },
  IMPORTANT: { label: 'Önemli', className: 'badge-warning' },
  URGENT: { label: 'Acil', className: 'badge-danger' },
}

const STATUS_LABEL_MAP: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Taslak', className: 'badge-neutral' },
  PUBLISHED: { label: 'Yayında', className: 'badge-success' },
  CANCELLED: { label: 'İptal Edildi', className: 'badge-muted' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function MegaphoneIcon({ width = 18, height = 18 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  )
}



export function AnnouncementManagement() {
  const { showToast } = useToast()

  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])

  // Filters
  const [propertyFilter, setPropertyFilter] = useState<number | 'all'>('all')
  const [buildingFilter, setBuildingFilter] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const pageSize = 15
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Selection & Drawer states
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementDto | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false)
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(false)

  // Create / Edit Form State
  const [formPropertyId, setFormPropertyId] = useState<number>(0)
  const [formBuildingId, setFormBuildingId] = useState<number | null>(null)
  const [formTitle, setFormTitle] = useState<string>('')
  const [formContent, setFormContent] = useState<string>('')
  const [formPriority, setFormPriority] = useState<string>('NORMAL')
  const [formBuildings, setFormBuildings] = useState<Building[]>([])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Confirmation dialogs
  const [publishConfirmId, setPublishConfirmId] = useState<number | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null)

  // Scroll refs for drawers
  const detailBodyRef = useRef<HTMLDivElement | null>(null)
  const createBodyRef = useRef<HTMLDivElement | null>(null)

  // Drawers animation & a11y hooks
  const { shouldRender: shouldRenderDetail, phase: detailPhase } = useAnimatedDrawer(isDetailDrawerOpen)
  const { shouldRender: shouldRenderCreate, phase: createPhase } = useAnimatedDrawer(isCreateDrawerOpen)

  const closeDetailDrawer = useCallback(() => {
    setIsDetailDrawerOpen(false)
    setIsEditing(false)
  }, [])

  const closeCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(false)
    setFormTitle('')
    setFormContent('')
    setFormPriority('NORMAL')
    setFormBuildingId(null)
  }, [])

  const isCreateDirty = formTitle.trim() !== '' || formContent.trim() !== ''
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isCreateDirty)

  const handleCloseCreateWithGuard = useCallback(async () => {
    if (await requestDiscard()) {
      closeCreateDrawer()
    }
  }, [closeCreateDrawer, requestDiscard])

  const detailDrawerRef = useDrawerAccessibility({
    isOpen: isDetailDrawerOpen,
    onClose: closeDetailDrawer,
  })

  const createDrawerRef = useDrawerAccessibility({
    isOpen: isCreateDrawerOpen,
    onClose: closeCreateDrawer,
    onRequestClose: () => { void handleCloseCreateWithGuard() },
  })

  // Reset drawer body scrollTop to 0 upon open
  useEffect(() => {
    if (isDetailDrawerOpen && detailBodyRef.current) {
      detailBodyRef.current.scrollTop = 0
    }
  }, [isDetailDrawerOpen, selectedAnnouncement])

  useEffect(() => {
    if (isCreateDrawerOpen && createBodyRef.current) {
      createBodyRef.current.scrollTop = 0
    }
  }, [isCreateDrawerOpen])

  // Load properties
  useEffect(() => {
    getProperties().then(setProperties).catch(() => {})
  }, [])

  // Filter building update
  useEffect(() => {
    if (typeof propertyFilter === 'number') {
      getBuildingsByProperty(propertyFilter).then(setBuildings).catch(() => setBuildings([]))
    } else {
      setBuildings([])
      setBuildingFilter('all')
    }
  }, [propertyFilter])

  // Form building update
  useEffect(() => {
    if (formPropertyId > 0) {
      getBuildingsByProperty(formPropertyId).then(setFormBuildings).catch(() => setFormBuildings([]))
    } else {
      setFormBuildings([])
    }
  }, [formPropertyId])

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getAnnouncements({
        propertyId: typeof propertyFilter === 'number' ? propertyFilter : undefined,
        buildingId: typeof buildingFilter === 'number' ? buildingFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search: searchQuery ? searchQuery.trim() : undefined,
        page,
        pageSize,
      })
      setAnnouncements(res.items)
      setTotalCount(res.totalCount)
    } catch (err: any) {
      showToast(err.message || 'Duyurular yüklenirken hata oluştu.')
    } finally {
      setIsLoading(false)
    }
  }, [propertyFilter, buildingFilter, statusFilter, priorityFilter, searchQuery, page, showToast])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  const location = useLocation()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const annId = params.get('announcementId')
    if (annId) {
      const id = Number(annId)
      if (!isNaN(id) && id > 0) {
        getAnnouncement(id)
          .then((ann) => {
            setSelectedAnnouncement(ann)
            setIsDetailDrawerOpen(true)
            window.history.replaceState({}, '', window.location.pathname)
          })
          .catch(() => {})
      }
    }
  }, [location.search])

  // Open Create Drawer
  const handleOpenCreate = () => {
    const defaultProp = properties[0]?.id || 0
    setFormPropertyId(defaultProp)
    setFormBuildingId(null)
    setFormTitle('')
    setFormContent('')
    setFormPriority('NORMAL')
    setIsCreateDrawerOpen(true)
  }

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formPropertyId || !formTitle.trim() || !formContent.trim()) {
      showToast('Lütfen gerekli alanları doldurun.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: CreateAnnouncementPayload = {
        propertyId: formPropertyId,
        buildingId: formBuildingId || null,
        title: formTitle.trim(),
        content: formContent.trim(),
        priority: formPriority,
      }
      await createAnnouncement(payload)
      showToast('Duyuru taslak olarak oluşturuldu.')
      closeCreateDrawer()
      fetchAnnouncements()
    } catch (err: any) {
      showToast(err.message || 'Duyuru oluşturulamadı.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open Detail Drawer
  const handleViewDetail = async (announcement: AnnouncementDto) => {
    try {
      const full = await getAnnouncement(announcement.id)
      setSelectedAnnouncement(full)
      setFormTitle(full.title)
      setFormContent(full.content)
      setFormPriority(full.priority)
      setIsEditing(false)
      setIsDetailDrawerOpen(true)
    } catch (err: any) {
      showToast(err.message || 'Duyuru detayı alınamadı.')
    }
  }

  // Handle Edit Submit
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAnnouncement || !formTitle.trim() || !formContent.trim()) return

    setIsSubmitting(true)
    try {
      const updated = await updateAnnouncement(selectedAnnouncement.id, {
        title: formTitle.trim(),
        content: formContent.trim(),
        priority: formPriority,
      })
      setSelectedAnnouncement(updated)
      setIsEditing(false)
      showToast('Duyuru güncellendi.')
      fetchAnnouncements()
    } catch (err: any) {
      showToast(err.message || 'Duyuru güncellenemedi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Publish Action
  const handleConfirmPublish = async () => {
    if (!publishConfirmId) return
    try {
      const updated = await publishAnnouncement(publishConfirmId)
      showToast('Duyuru yayınlandı ve bildirimler gönderildi.')
      setPublishConfirmId(null)
      if (selectedAnnouncement?.id === publishConfirmId) {
        setSelectedAnnouncement(updated)
      }
      fetchAnnouncements()
    } catch (err: any) {
      showToast(err.message || 'Duyuru yayınlanamadı.')
    }
  }

  // Handle Cancel Action
  const handleConfirmCancel = async () => {
    if (!cancelConfirmId) return
    try {
      const updated = await cancelAnnouncement(cancelConfirmId)
      showToast('Duyuru iptal edildi.')
      setCancelConfirmId(null)
      if (selectedAnnouncement?.id === cancelConfirmId) {
        setSelectedAnnouncement(updated)
      }
      fetchAnnouncements()
    } catch (err: any) {
      showToast(err.message || 'Duyuru iptal edilemedi.')
    }
  }

  return (
    <div className="management-page">
      {/* Compact Page Action Strip */}
      <div className="entity-action-strip">
        <div className="entity-action-strip-info">
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--color-surface-secondary)',
              color: 'var(--color-primary)',
              flexShrink: 0,
            }}
          >
            <MegaphoneIcon width={20} height={20} />
          </div>
          <div className="entity-action-strip-text">
            <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--color-text-primary)' }}>
              Duyuru Yönetimi
            </strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Site veya blok bazlı duyuruları oluşturun, yayınlayın ve geçmişi takip edin.
            </span>
          </div>
        </div>
        <button className="primary-button" type="button" onClick={handleOpenCreate}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Yeni Duyuru
        </button>
      </div>

      {/* Standard Entity Toolbar */}
      <section className="panel entity-toolbar announcement-toolbar" aria-label="Duyuru filtreleri">
        <div className="form-field">
          <label htmlFor="announcement-prop-filter">Site / Apartman</label>
          <select
            id="announcement-prop-filter"
            value={propertyFilter}
            onChange={(e) => {
              const val = e.target.value
              setPropertyFilter(val === 'all' ? 'all' : Number(val))
              setPage(1)
            }}
          >
            <option value="all">Tüm Siteler</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="announcement-bldg-filter">Blok</label>
          <select
            id="announcement-bldg-filter"
            value={buildingFilter}
            disabled={propertyFilter === 'all'}
            onChange={(e) => {
              const val = e.target.value
              setBuildingFilter(val === 'all' ? 'all' : Number(val))
              setPage(1)
            }}
          >
            <option value="all">Tüm Bloklar</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="announcement-status-filter">Durum</label>
          <select
            id="announcement-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayında</option>
            <option value="CANCELLED">İptal Edildi</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="announcement-priority-filter">Öncelik</label>
          <select
            id="announcement-priority-filter"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tüm Öncelikler</option>
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Önemli</option>
            <option value="URGENT">Acil</option>
          </select>
        </div>

        <div className="form-field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="announcement-search">Arama</label>
          <input
            id="announcement-search"
            type="text"
            placeholder="Duyuru başlığında ara..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
          />
        </div>

        {(propertyFilter !== 'all' || buildingFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || Boolean(searchQuery)) && (
          <div className="form-field" style={{ justifyContent: 'flex-end', flex: '0 0 auto' }}>
            <label>&nbsp;</label>
            <button
              type="button"
              className="ghost-button"
              style={{ fontSize: '13px', height: '38px', whiteSpace: 'nowrap' }}
              onClick={() => {
                setPropertyFilter('all')
                setBuildingFilter('all')
                setStatusFilter('all')
                setPriorityFilter('all')
                setSearchQuery('')
                setPage(1)
              }}
            >
              Filtreleri Temizle
            </button>
          </div>
        )}
      </section>

      {/* Announcements Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={5} />
      ) : announcements.length === 0 ? (
        <section className="panel entity-state-panel actionable-empty-state">
          <h2>Kriterlere uygun duyuru bulunamadı</h2>
          <p>Filtre parametrelerini değiştirebilir veya yeni bir duyuru oluşturabilirsiniz.</p>
          <button className="primary-button" type="button" onClick={handleOpenCreate}>
            Yeni Duyuru
          </button>
        </section>
      ) : (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Başlık</th>
                  <th>Kapsam</th>
                  <th>Öncelik</th>
                  <th>Durum</th>
                  <th>Yayın Tarihi</th>
                  <th>Oluşturan</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((a) => {
                  const prio = PRIORITY_LABEL_MAP[a.priority] || { label: a.priority, className: 'badge-secondary' }
                  const status = STATUS_LABEL_MAP[a.status] || { label: a.status, className: 'badge-secondary' }
                  return (
                    <tr key={a.id} className="clickable-row" onClick={() => handleViewDetail(a)}>
                      <td>
                        <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.92rem' }}>{a.title}</strong>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>
                        {a.propertyName} {a.buildingName ? ` / ${a.buildingName}` : ' (Site Geneli)'}
                      </td>
                      <td>
                        <span className={`status-badge ${prio.className}`}>{prio.label}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${status.className}`}>{status.label}</span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{formatDate(a.publishedAt)}</td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{a.createdByName}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="button outline small"
                          type="button"
                          onClick={() => handleViewDetail(a)}
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="pagination">
          <button
            className="button outline small"
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Önceki
          </button>
          <span>
            Sayfa {page} / {Math.ceil(totalCount / pageSize)}
          </span>
          <button
            className="button outline small"
            type="button"
            disabled={page >= Math.ceil(totalCount / pageSize)}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki
          </button>
        </div>
      )}

      {/* Create Drawer */}
      {shouldRenderCreate && (
        <>
          <button
            className={`drawer-backdrop drawer-${createPhase}`}
            type="button"
            aria-label="Yeni duyuru formunu kapat"
            onClick={() => void handleCloseCreateWithGuard()}
          />
          <aside
            ref={createDrawerRef as any}
            className={`management-drawer announcement-drawer drawer-container drawer-${createPhase}`}
            role="dialog"
            aria-modal="true"
            aria-label="Yeni Duyuru Oluştur"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Duyuru Yönetimi</p>
                <h3>Yeni Duyuru Oluştur</h3>
              </div>
              <button className="drawer-close-button" type="button" onClick={() => void handleCloseCreateWithGuard()}>
                ✕
              </button>
            </div>

            <div className="drawer-body" ref={createBodyRef}>
              <form id="create-announcement-form" onSubmit={handleCreateSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="create-prop">Site / Apartman *</label>
                    <select
                      id="create-prop"
                      value={formPropertyId}
                      onChange={(e) => {
                        setFormPropertyId(Number(e.target.value))
                        setFormBuildingId(null)
                      }}
                      required
                    >
                      <option value={0} disabled>
                        Site Seçin...
                      </option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="create-bldg">Blok (Opsiyonel)</label>
                    <select
                      id="create-bldg"
                      value={formBuildingId || ''}
                      onChange={(e) => setFormBuildingId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Site Geneli (Tüm Bloklar)</option>
                      {formBuildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="create-title">Başlık *</label>
                    <input
                      id="create-title"
                      type="text"
                      placeholder="Duyuru başlığı girin..."
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="create-priority">Öncelik Derecesi</label>
                    <select
                      id="create-priority"
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value)}
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="IMPORTANT">Önemli</option>
                      <option value="URGENT">Acil</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="create-content">İçerik *</label>
                  <textarea
                    id="create-content"
                    rows={7}
                    placeholder="Duyuru metnini detaylıca yazın..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    required
                  />
                </div>
              </form>
            </div>

            <div className="drawer-footer">
              <button className="secondary-button" type="button" onClick={closeCreateDrawer}>
                Vazgeç
              </button>
              <button className="primary-button" type="submit" form="create-announcement-form" disabled={isSubmitting}>
                {isSubmitting ? 'Oluşturuluyor...' : 'Taslak Oluştur'}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Detail / Edit Drawer */}
      {shouldRenderDetail && selectedAnnouncement && (
        <>
          <button
            className={`drawer-backdrop drawer-${detailPhase}`}
            type="button"
            aria-label="Duyuru detayını kapat"
            onClick={closeDetailDrawer}
          />
          <aside
            ref={detailDrawerRef as any}
            className={`management-drawer announcement-drawer drawer-container drawer-${detailPhase}`}
            role="dialog"
            aria-modal="true"
            aria-label="Duyuru Detayı"
          >
            <div className="drawer-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'var(--color-surface-secondary)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    <MegaphoneIcon width={14} height={14} />
                  </div>
                  <span className={`status-badge ${(STATUS_LABEL_MAP[selectedAnnouncement.status] || {}).className}`}>
                    {(STATUS_LABEL_MAP[selectedAnnouncement.status] || {}).label || selectedAnnouncement.status}
                  </span>
                  <span className={`status-badge ${(PRIORITY_LABEL_MAP[selectedAnnouncement.priority] || {}).className}`}>
                    {(PRIORITY_LABEL_MAP[selectedAnnouncement.priority] || {}).label || selectedAnnouncement.priority}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>{selectedAnnouncement.title}</h3>
              </div>
              <button className="drawer-close-button" type="button" onClick={closeDetailDrawer}>
                ✕
              </button>
            </div>

            <div className="drawer-body" ref={detailBodyRef} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {isEditing ? (
                <form id="edit-announcement-form" onSubmit={handleUpdateSubmit} className="edit-form">
                  {selectedAnnouncement.status === 'PUBLISHED' && (
                    <div
                      className="info-banner small"
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: 'var(--color-primary-soft)',
                        color: 'var(--color-primary)',
                        marginBottom: '16px',
                        fontSize: '0.85rem',
                      }}
                    >
                      Yayınlanmış duyuruda yapılan düzenlemeler yeni bir bildirim göndermez.
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="edit-title">Başlık *</label>
                    <input
                      id="edit-title"
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-priority">Öncelik</label>
                    <select
                      id="edit-priority"
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value)}
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="IMPORTANT">Önemli</option>
                      <option value="URGENT">Acil</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-content">İçerik *</label>
                    <textarea
                      id="edit-content"
                      rows={8}
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      required
                    />
                  </div>
                </form>
              ) : (
                <div className="announcement-detail-content" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Compact 2-column metadata surface */}
                  <div
                    className="detail-meta-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '10px 14px',
                      padding: '12px 14px',
                      background: 'var(--color-surface-secondary)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div>
                      <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.74rem' }}>Kapsam</small>
                      <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.88rem' }}>
                        {selectedAnnouncement.propertyName}{' '}
                        {selectedAnnouncement.buildingName ? ` / ${selectedAnnouncement.buildingName}` : ' (Site Geneli)'}
                      </strong>
                    </div>
                    <div>
                      <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.74rem' }}>Oluşturan</small>
                      <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.88rem' }}>{selectedAnnouncement.createdByName}</strong>
                    </div>
                    <div>
                      <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.74rem' }}>Oluşturulma Tarihi</small>
                      <span style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>{formatDate(selectedAnnouncement.createdAt)}</span>
                    </div>
                    {selectedAnnouncement.publishedAt && (
                      <div>
                        <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.74rem' }}>Yayınlanma Tarihi</small>
                        <span style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>{formatDate(selectedAnnouncement.publishedAt)}</span>
                      </div>
                    )}
                    {selectedAnnouncement.updatedAt && selectedAnnouncement.updatedAt !== selectedAnnouncement.createdAt && (
                      <div>
                        <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.74rem' }}>Son Güncelleme</small>
                        <span style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>{formatDate(selectedAnnouncement.updatedAt)}</span>
                      </div>
                    )}
                    {selectedAnnouncement.cancelledAt && (
                      <div>
                        <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.74rem' }}>İptal Tarihi</small>
                        <span style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>{formatDate(selectedAnnouncement.cancelledAt)}</span>
                      </div>
                    )}
                  </div>

                  {/* Compact Notice Content Panel */}
                  <div className="detail-section">
                    <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Duyuru İçeriği</span>
                    <div
                      className="announcement-text-box"
                      style={{
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.5',
                        padding: '14px',
                        background: 'var(--color-surface)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        borderLeft:
                          selectedAnnouncement.priority === 'URGENT'
                            ? '4px solid var(--color-danger)'
                            : selectedAnnouncement.priority === 'IMPORTANT'
                              ? '4px solid var(--color-warning)'
                              : '4px solid var(--color-primary)',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.9rem',
                      }}
                    >
                      {selectedAnnouncement.content}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {selectedAnnouncement.status !== 'CANCELLED' && (
              <div className="drawer-footer">
                {isEditing ? (
                  <>
                    <button className="button outline" type="button" onClick={() => setIsEditing(false)}>
                      İptal
                    </button>
                    <button className="primary-button" type="submit" form="edit-announcement-form" disabled={isSubmitting}>
                      Kaydet
                    </button>
                  </>
                ) : (
                  <>
                    {selectedAnnouncement.status === 'DRAFT' && (
                      <>
                        <button className="button secondary" type="button" onClick={() => setIsEditing(true)}>
                          Düzenle
                        </button>
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() => setPublishConfirmId(selectedAnnouncement.id)}
                        >
                          Yayınla
                        </button>
                        <button
                          className="button danger filled"
                          type="button"
                          onClick={() => setCancelConfirmId(selectedAnnouncement.id)}
                        >
                          İptal Et
                        </button>
                      </>
                    )}

                    {selectedAnnouncement.status === 'PUBLISHED' && (
                      <>
                        <button className="button secondary" type="button" onClick={() => setIsEditing(true)}>
                          Düzenle
                        </button>
                        <button
                          className="button danger filled"
                          type="button"
                          onClick={() => setCancelConfirmId(selectedAnnouncement.id)}
                        >
                          İptal Et
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </aside>
        </>
      )}

      {/* Confirmation Dialogs */}
      {publishConfirmId !== null && (
        <ConfirmationDialog
          title="Duyuruyu Yayınla"
          message="Bu duyuru ilgili sakinlere yayınlanacak ve bildirim gönderilecek. Devam etmek istiyor musunuz?"
          confirmLabel="Yayınla"
          cancelLabel="Vazgeç"
          onConfirm={handleConfirmPublish}
          onCancel={() => setPublishConfirmId(null)}
        />
      )}

      {cancelConfirmId !== null && (
        <ConfirmationDialog
          title="Duyuruyu İptal Et"
          message="Duyuru aktif sakin görünümünden kaldırılacak ancak geçmiş kaydı korunacaktır. Devam etmek istiyor musunuz?"
          confirmLabel="İptal Et"
          cancelLabel="Vazgeç"
          danger
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelConfirmId(null)}
        />
      )}

      {unsavedChangesDialog}
    </div>
  )
}
