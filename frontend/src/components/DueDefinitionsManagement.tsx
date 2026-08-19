import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  activateDueDefinition,
  createDueDefinition,
  deactivateDueDefinition,
  getBuildingsByProperty,
  getDueDefinitions,
  getProperties,
  updateDueDefinition,
} from '../api'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'
import type {
  Building,
  CreateDueDefinitionPayload,
  DueDefinition,
  Property,
  UpdateDueDefinitionPayload,
} from '../types'

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '0,00 ₺'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function DueDefinitionsManagement() {
  const { showToast } = useToast()

  // Main list & loading state
  const [definitions, setDefinitions] = useState<DueDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  // Lookups
  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])

  // Filters
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [buildingFilter, setBuildingFilter] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Drawer state & animation hooks
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingDefinition, setEditingDefinition] = useState<DueDefinition | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const drawerAnimation = useAnimatedDrawer(isDrawerOpen)
  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.shouldRender && !drawerAnimation.isClosing,
    onClose: () => setIsDrawerOpen(false),
    isSaving: isSubmitting,
  })

  // Drawer form fields
  const [formPropertyId, setFormPropertyId] = useState<number>(0)
  const [formBuildingId, setFormBuildingId] = useState<number | null>(null)
  const [formTitle, setFormTitle] = useState<string>('')
  const [formDescription, setFormDescription] = useState<string>('')
  const [formAmount, setFormAmount] = useState<string>('')
  const [formDueDay, setFormDueDay] = useState<string>('15')
  const [formBuildings, setFormBuildings] = useState<Building[]>([])
  const [formError, setFormError] = useState<string>('')

  // Confirmation dialog state
  const [toggleConfirmTarget, setToggleConfirmTarget] = useState<DueDefinition | null>(null)
  const [isToggling, setIsToggling] = useState(false)

  // Load properties lookup on mount
  useEffect(() => {
    async function loadProperties() {
      try {
        const data = await getProperties()
        setProperties(data)
      } catch (err) {
        // Handled silently
      }
    }
    void loadProperties()
  }, [])

  // Load buildings when property filter changes
  useEffect(() => {
    async function loadFilterBuildings() {
      if (propertyFilter === 'all') {
        setBuildings([])
        setBuildingFilter('all')
        return
      }
      try {
        const data = await getBuildingsByProperty(Number(propertyFilter))
        setBuildings(data)
      } catch (err) {
        setBuildings([])
      }
    }
    void loadFilterBuildings()
  }, [propertyFilter])

  // Load buildings for form when formPropertyId changes
  useEffect(() => {
    async function loadFormBuildings() {
      if (!formPropertyId) {
        setFormBuildings([])
        return
      }
      try {
        const data = await getBuildingsByProperty(formPropertyId)
        setFormBuildings(data)
      } catch (err) {
        setFormBuildings([])
      }
    }
    void loadFormBuildings()
  }, [formPropertyId])

  // Load Due Definitions list
  const loadDefinitions = useCallback(async () => {
    setIsLoading(true)
    setListError('')
    try {
      const pId = propertyFilter !== 'all' ? Number(propertyFilter) : undefined
      const bId = buildingFilter !== 'all' ? Number(buildingFilter) : undefined
      const act = activeFilter === 'active' ? true : activeFilter === 'passive' ? false : undefined

      const data = await getDueDefinitions({
        propertyId: pId,
        buildingId: bId,
        isActive: act,
      })
      setDefinitions(data)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Aidat tanımları yüklenemedi.')
      showToast('Aidat tanımları yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [propertyFilter, buildingFilter, activeFilter, showToast])

  useEffect(() => {
    void loadDefinitions()
  }, [loadDefinitions])

  // Filter list by searchQuery
  const filteredDefinitions = useMemo(() => {
    if (!searchQuery.trim()) return definitions
    const q = searchQuery.toLowerCase()
    return definitions.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        d.propertyName.toLowerCase().includes(q) ||
        (d.buildingName && d.buildingName.toLowerCase().includes(q))
    )
  }, [definitions, searchQuery])

  // Open Drawer for Create
  const handleOpenCreateDrawer = () => {
    setEditingDefinition(null)
    setFormPropertyId(properties[0]?.id || 0)
    setFormBuildingId(null)
    setFormTitle('')
    setFormDescription('')
    setFormAmount('')
    setFormDueDay('15')
    setFormError('')
    setIsDrawerOpen(true)
  }

  // Open Drawer for Edit
  const handleOpenEditDrawer = (item: DueDefinition) => {
    setEditingDefinition(item)
    setFormPropertyId(item.propertyId)
    setFormBuildingId(item.buildingId)
    setFormTitle(item.title)
    setFormDescription(item.description || '')
    setFormAmount(item.amount.toString())
    setFormDueDay(item.dueDay.toString())
    setFormError('')
    setIsDrawerOpen(true)
  }

  // Submit Drawer Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!editingDefinition && !formPropertyId) {
      setFormError('Lütfen bir gayrimenkul/site seçin.')
      return
    }

    if (!formTitle.trim()) {
      setFormError('Aidat tanım başlığı zorunludur.')
      return
    }

    const amt = Number.parseFloat(formAmount.replace(',', '.'))
    if (Number.isNaN(amt) || amt <= 0) {
      setFormError('Aidat tutarı 0\'dan büyük geçerli bir sayı olmalıdır.')
      return
    }

    const dueDayNum = Number.parseInt(formDueDay, 10)
    if (Number.isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 28) {
      setFormError('Son ödeme günü 1 ile 28 arasında bir tamsayı olmalıdır.')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingDefinition) {
        const payload: UpdateDueDefinitionPayload = {
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          amount: amt,
          dueDay: dueDayNum,
        }
        await updateDueDefinition(editingDefinition.id, payload)
        showToast('Aidat tanımı başarıyla güncellendi.')
      } else {
        const payload: CreateDueDefinitionPayload = {
          propertyId: formPropertyId,
          buildingId: formBuildingId,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          amount: amt,
          dueDay: dueDayNum,
        }
        await createDueDefinition(payload)
        showToast('Yeni aidat tanımı başarıyla oluşturuldu.')
      }
      setIsDrawerOpen(false)
      void loadDefinitions()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'İşlem gerçekleştirilemedi.'
      setFormError(msg)
      showToast(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle Active / Deactive Confirm Handler
  const handleConfirmToggleActive = async () => {
    if (!toggleConfirmTarget) return
    setIsToggling(true)
    try {
      if (toggleConfirmTarget.isActive) {
        await deactivateDueDefinition(toggleConfirmTarget.id)
        showToast('Aidat tanımı pasife alındı.')
      } else {
        await activateDueDefinition(toggleConfirmTarget.id)
        showToast('Aidat tanımı aktife alındı.')
      }
      setToggleConfirmTarget(null)
      void loadDefinitions()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Durum değiştirilemedi.')
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <div className="section-container entity-management-view">
      {/* Standard Entity Page Actions Header */}
      <div className="entity-page-actions">
        <p>{!isLoading && !listError ? `${filteredDefinitions.length} aidat tanımı gösteriliyor.` : 'Aidat tanımlarını görüntüleyin.'}</p>
        <button
          type="button"
          className="primary-button"
          onClick={handleOpenCreateDrawer}
        >
          + Yeni Aidat Tanımı
        </button>
      </div>

      {/* Standard Entity Toolbar */}
      <section className="panel entity-toolbar due-toolbar" aria-label="Aidat tanımı filtreleri">
        <div className="form-field">
          <label htmlFor="due-def-prop-filter">Gayrimenkul</label>
          <select
            id="due-def-prop-filter"
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
          >
            <option value="all">Tüm Gayrimenkuller</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id.toString()}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="due-def-bldg-filter">Blok</label>
          <select
            id="due-def-bldg-filter"
            value={buildingFilter}
            disabled={propertyFilter === 'all'}
            onChange={(e) => setBuildingFilter(e.target.value)}
          >
            <option value="all">Tüm Bloklar</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id.toString()}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="due-def-status-filter">Durum</label>
          <select
            id="due-def-status-filter"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="all">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="due-def-search-input">Arama</label>
          <input
            id="due-def-search-input"
            type="text"
            placeholder="Başlık veya açıklama ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Main Content: Sleek Grid List */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : listError ? (
        <div className="panel status-message error-message">
          <p>{listError}</p>
          <button type="button" className="secondary-button" style={{ marginTop: '8px' }} onClick={() => { void loadDefinitions() }}>
            Tekrar Dene
          </button>
        </div>
      ) : filteredDefinitions.length === 0 ? (
        <div className="panel status-message" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Kayıtlı aidat tanımı bulunamadı.</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
            Filtrelerinizi değiştirebilir veya yeni bir aidat tanımı ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="panel due-definitions-panel">
          {filteredDefinitions.map((item) => (
            <div key={item.id} className="due-def-row">
              {/* Title & Desc */}
              <div className="due-def-info-col">
                <span className="due-def-title-text">{item.title}</span>
                {item.description && <span className="due-def-desc-text">{item.description}</span>}
              </div>

              {/* Scope Chip */}
              <div className="due-def-scope-col">
                <span className="due-def-scope-chip">
                  {item.buildingName ? `${item.propertyName} · ${item.buildingName}` : item.propertyName ? `${item.propertyName} (Site Geneli)` : 'Site Geneli'}
                </span>
              </div>

              {/* Amount & Due Day */}
              <div className="due-def-amount-col">
                <span className="due-def-amount-val">{formatCurrency(item.amount)}</span>
                <span className="due-def-day-val">Ayın {item.dueDay}'i</span>
              </div>

              {/* Status & Compact Actions */}
              <div className="due-def-action-col">
                <span className={`status-badge ${item.isActive ? 'badge-success' : 'badge-secondary'}`}>
                  {item.isActive ? 'Aktif' : 'Pasif'}
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => handleOpenEditDrawer(item)}
                >
                  Düzenle
                </button>

                <button
                  type="button"
                  className="secondary-button due-compact-toggle-btn"
                  onClick={() => setToggleConfirmTarget(item)}
                  title={item.isActive ? 'Pasife Al' : 'Aktife Al'}
                >
                  {item.isActive ? 'Pasif' : 'Aktif'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer for Create / Edit */}
      {drawerAnimation.shouldRender && (
        <>
          <button
            className={`drawer-backdrop drawer-${drawerAnimation.phase}`}
            type="button"
            aria-label="Kapat"
            disabled={drawerAnimation.isClosing}
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className={`management-drawer drawer-${drawerAnimation.phase}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Aidat Yönetimi</p>
                <h2>{editingDefinition ? 'Aidat Tanımını Düzenle' : 'Yeni Aidat Tanımı'}</h2>
                <p className="drawer-description">Aidat şablon tutarlarını ve kapsamını tanımlayın.</p>
              </div>
              <button className="drawer-close-button" type="button" onClick={() => setIsDrawerOpen(false)}>×</button>
            </div>

            <form className="property-form drawer-form" onSubmit={(e) => { void handleSubmitForm(e) }}>
              {formError && (
                <div className="status-message error-message">
                  {formError}
                </div>
              )}

              {/* Property Select */}
              <div className="form-field form-field-full">
                <label htmlFor="form-due-def-prop">
                  Gayrimenkul / Site *
                </label>
                <select
                  id="form-due-def-prop"
                  value={formPropertyId}
                  disabled={Boolean(editingDefinition)}
                  onChange={(e) => setFormPropertyId(Number(e.target.value))}
                  required
                >
                  <option value={0} disabled>Gayrimenkul Seçin</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Building Select (Optional) */}
              <div className="form-field form-field-full">
                <label htmlFor="form-due-def-bldg">Bina / Blok (Opsiyonel)</label>
                <select
                  id="form-due-def-bldg"
                  value={formBuildingId || ''}
                  disabled={Boolean(editingDefinition)}
                  onChange={(e) => setFormBuildingId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Tüm Bloklar (Site Geneli)</option>
                  {formBuildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <small className="field-help">
                  {editingDefinition ? 'Gayrimenkul ve Blok kapsamı oluşturma sonrasında değiştirilemez.' : 'Blok seçilmezse aidat tanımı tüm site geneline uygulanabilir.'}
                </small>
              </div>

              {/* Title */}
              <div className="form-field form-field-full">
                <label htmlFor="form-due-def-title">
                  Başlık *
                </label>
                <input
                  id="form-due-def-title"
                  type="text"
                  maxLength={150}
                  placeholder="Örn: 2026 Standart Yönetim Aidatı"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="form-field form-field-full">
                <label htmlFor="form-due-def-desc">Açıklama</label>
                <textarea
                  id="form-due-def-desc"
                  rows={3}
                  maxLength={500}
                  placeholder="Aidat kapsamı hakkında kısa açıklama..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* Amount */}
              <div className="form-field form-field-full">
                <label htmlFor="form-due-def-amount">
                  Birim Tutar (₺) *
                </label>
                <input
                  id="form-due-def-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                />
              </div>

              {/* DueDay */}
              <div className="form-field form-field-full">
                <label htmlFor="form-due-def-dueday">
                  Son Ödeme Günü (Ayın 1 - 28. Günü) *
                </label>
                <input
                  id="form-due-def-dueday"
                  type="number"
                  min="1"
                  max="28"
                  value={formDueDay}
                  onChange={(e) => setFormDueDay(e.target.value)}
                  required
                />
              </div>

              {/* Submit Action */}
              <div className="drawer-actions form-field-full">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsDrawerOpen(false)}
                  disabled={isSubmitting}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? 'Kaydediliyor...' : editingDefinition ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* Confirmation Dialog for Toggle Active/Passive */}
      {toggleConfirmTarget && (
        <ConfirmationDialog
          title={toggleConfirmTarget.isActive ? 'Aidat Tanımını Pasife Al' : 'Aidat Tanımını Aktife Al'}
          message={`"${toggleConfirmTarget.title}" isimli aidat tanımının durumunu ${toggleConfirmTarget.isActive ? 'PASİF' : 'AKTİF'} yapmak istediğinize emin misiniz?`}
          confirmLabel={toggleConfirmTarget.isActive ? 'Pasife Al' : 'Aktife Al'}
          danger={toggleConfirmTarget.isActive}
          isLoading={isToggling}
          onConfirm={() => { void handleConfirmToggleActive() }}
          onCancel={() => setToggleConfirmTarget(null)}
        />
      )}
    </div>
  )
}
