import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  apportionExpense,
  cancelExpense,
  createExpense,
  getApportionmentPreview,
  getBuildingsByProperty,
  getExpenses,
  getProperties,
  getUnitsByBuilding,
  getUnitsByProperty,
  updateExpense,
} from '../api'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { LoadingSkeleton } from './LoadingSkeleton'
import { PageHeader } from './PageHeader'
import { RowActionsMenu } from './RowActionsMenu'
import type {
  ApportionExpensePayload,
  Building,
  CancelExpensePayload,
  CreateExpensePayload,
  Expense,
  ExpenseApportionmentPreview,
  ManualUnitApportionmentItem,
  Property,
  Unit,
  UpdateExpensePayload,
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

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const EXPENSE_CATEGORIES = [
  { value: 'TEMIZLIK', label: 'Temizlik & Hijyen' },
  { value: 'GUVENLIK', label: 'Güvenlik Servisi' },
  { value: 'BAKIM_ONARIM', label: 'Bakım & Onarım' },
  { value: 'PEYZAJ', label: 'Peyzaj & Bahçe Bakımı' },
  { value: 'ELEKTRIK_SU', label: 'Ortak Elektrik & Su' },
  { value: 'YONETIM', label: 'Yönetim & Hizmet Bedeli' },
  { value: 'DIGER', label: 'Diğer Ortak Giderler' },
]

export function ExpensesManagement() {
  const { showToast } = useToast()

  // Main list & loading state
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  // Lookups
  const [properties, setProperties] = useState<Property[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])

  // Filters
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [buildingFilter, setBuildingFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Create / Edit Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
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
  const [formCategory, setFormCategory] = useState<string>('BAKIM_ONARIM')
  const [formAmount, setFormAmount] = useState<string>('')
  const [formExpenseDate, setFormExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [formDocumentNumber, setFormDocumentNumber] = useState<string>('')
  const [formVendorName, setFormVendorName] = useState<string>('')
  const [formDescription, setFormDescription] = useState<string>('')
  const [formBuildings, setFormBuildings] = useState<Building[]>([])
  const [formError, setFormError] = useState<string>('')

  // Cancel Modal state
  const [cancelTargetExpense, setCancelTargetExpense] = useState<Expense | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  // Apportionment Modal state
  const [apportionTargetExpense, setApportionTargetExpense] = useState<Expense | null>(null)
  const [apportionMode, setApportionMode] = useState<'EQUAL_SCOPE' | 'EQUAL_SELECTED' | 'MANUAL_SELECTED'>('EQUAL_SCOPE')
  const [apportionDueDate, setApportionDueDate] = useState<string>('')
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)
  const [unitSearchQuery, setUnitSearchQuery] = useState('')
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([])
  const [manualAmounts, setManualAmounts] = useState<Record<number, string>>({})
  const [apportionError, setApportionError] = useState('')

  // Preview & Final Apportionment state
  const [previewData, setPreviewData] = useState<ExpenseApportionmentPreview | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isApportioning, setIsApportioning] = useState(false)

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

  // Load buildings for drawer form when formPropertyId changes
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

  // Load Expenses list
  const loadExpenseList = useCallback(async () => {
    setIsLoading(true)
    setListError('')
    try {
      const pId = propertyFilter !== 'all' ? Number(propertyFilter) : undefined
      const bId = buildingFilter !== 'all' ? Number(buildingFilter) : undefined
      const cat = categoryFilter !== 'all' ? categoryFilter : undefined
      const cancelled = statusFilter === 'cancelled' ? true : statusFilter !== 'all' ? false : undefined
      const apportioned = statusFilter === 'apportioned' ? true : statusFilter === 'unapportioned' ? false : undefined

      const data = await getExpenses({
        propertyId: pId,
        buildingId: bId,
        category: cat,
        isCancelled: cancelled,
        isApportioned: apportioned,
      })
      setExpenses(data)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Gider kayıtları yüklenemedi.')
      showToast('Gider kayıtları yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [propertyFilter, buildingFilter, categoryFilter, statusFilter, showToast])

  useEffect(() => {
    void loadExpenseList()
  }, [loadExpenseList])

  // Filter list by searchQuery
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses
    const q = searchQuery.toLowerCase()
    return expenses.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.vendorName && e.vendorName.toLowerCase().includes(q)) ||
        (e.documentNumber && e.documentNumber.toLowerCase().includes(q)) ||
        e.propertyName.toLowerCase().includes(q) ||
        (e.buildingName && e.buildingName.toLowerCase().includes(q))
    )
  }, [expenses, searchQuery])

  // Open Drawer for Create
  const handleOpenCreateDrawer = () => {
    setEditingExpense(null)
    setFormPropertyId(properties[0]?.id || 0)
    setFormBuildingId(null)
    setFormTitle('')
    setFormCategory('BAKIM_ONARIM')
    setFormAmount('')
    setFormExpenseDate(new Date().toISOString().split('T')[0])
    setFormDocumentNumber('')
    setFormVendorName('')
    setFormDescription('')
    setFormError('')
    setIsDrawerOpen(true)
  }

  // Open Drawer for Edit
  const handleOpenEditDrawer = (item: Expense) => {
    setEditingExpense(item)
    setFormPropertyId(item.propertyId)
    setFormBuildingId(item.buildingId)
    setFormTitle(item.title)
    setFormCategory(item.category || 'BAKIM_ONARIM')
    setFormAmount(item.amount.toString())
    setFormExpenseDate(
      item.expenseDate ? new Date(item.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    )
    setFormDocumentNumber(item.documentNumber || '')
    setFormVendorName(item.vendorName || '')
    setFormDescription(item.description || '')
    setFormError('')
    setIsDrawerOpen(true)
  }

  // Submit Drawer Form (Create / Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!editingExpense && !formPropertyId) {
      setFormError('Lütfen bir gayrimenkul/site seçin.')
      return
    }

    if (!formTitle.trim()) {
      setFormError('Gider başlığı zorunludur.')
      return
    }

    const amt = Number.parseFloat(formAmount.replace(',', '.'))
    if (Number.isNaN(amt) || amt <= 0) {
      setFormError('Gider tutarı 0\'dan büyük geçerli bir sayı olmalıdır.')
      return
    }

    if (!formExpenseDate) {
      setFormError('Gider tarihi zorunludur.')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingExpense) {
        const payload: UpdateExpensePayload = {
          title: formTitle.trim(),
          category: formCategory,
          amount: amt,
          expenseDate: new Date(formExpenseDate).toISOString(),
          documentNumber: formDocumentNumber.trim() || null,
          vendorName: formVendorName.trim() || null,
          description: formDescription.trim() || null,
        }
        await updateExpense(editingExpense.id, payload)
        showToast('Gider kaydı başarıyla güncellendi.')
      } else {
        const payload: CreateExpensePayload = {
          propertyId: formPropertyId,
          buildingId: formBuildingId,
          title: formTitle.trim(),
          category: formCategory,
          amount: amt,
          expenseDate: new Date(formExpenseDate).toISOString(),
          documentNumber: formDocumentNumber.trim() || null,
          vendorName: formVendorName.trim() || null,
          description: formDescription.trim() || null,
        }
        await createExpense(payload)
        showToast('Yeni gider kaydı başarıyla oluşturuldu.')
      }
      setIsDrawerOpen(false)
      void loadExpenseList()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'İşlem gerçekleştirilemedi.'
      setFormError(msg)
      showToast(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Cancel Form
  const handleSubmitCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancelTargetExpense) return
    setCancelError('')

    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      setCancelError('İptal gerekçesi en az 3 karakter olmalıdır.')
      return
    }

    setIsCancelling(true)
    try {
      const payload: CancelExpensePayload = {
        cancelReason: cancelReason.trim(),
      }
      await cancelExpense(cancelTargetExpense.id, payload)
      showToast('Gider kaydı iptal edildi.')
      setCancelTargetExpense(null)
      void loadExpenseList()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gider iptal edilemedi.'
      setCancelError(msg)
      showToast(msg)
    } finally {
      setIsCancelling(false)
    }
  }

  // Open Apportionment Modal
  const handleOpenApportionModal = async (item: Expense) => {
    setApportionTargetExpense(item)
    setApportionMode('EQUAL_SCOPE')
    setApportionError('')
    setPreviewData(null)
    setSelectedUnitIds([])
    setManualAmounts({})

    // Set default due date to 15 days after expense date or today
    const baseDate = new Date(item.expenseDate || Date.now())
    baseDate.setDate(baseDate.getDate() + 15)
    setApportionDueDate(baseDate.toISOString().split('T')[0])

    // Load available units for apportionment scope
    setIsLoadingUnits(true)
    try {
      let unitData: Unit[] = []
      if (item.buildingId) {
        unitData = await getUnitsByBuilding(item.buildingId, false)
      } else {
        unitData = await getUnitsByProperty(item.propertyId, false)
      }
      setAvailableUnits(unitData)
    } catch (err) {
      setAvailableUnits([])
    } finally {
      setIsLoadingUnits(false)
    }
  }

  // Filter units inside modal
  const filteredAvailableUnits = useMemo(() => {
    if (!unitSearchQuery.trim()) return availableUnits
    const q = unitSearchQuery.toLowerCase()
    return availableUnits.filter(
      (u) =>
        u.unitNumber.toLowerCase().includes(q) ||
        u.buildingName.toLowerCase().includes(q)
    )
  }, [availableUnits, unitSearchQuery])

  // Build Payload for Apportionment
  const buildApportionPayload = (): ApportionExpensePayload | null => {
    if (!apportionDueDate) {
      setApportionError('Lütfen son ödeme tarihini seçin.')
      return null
    }

    if (apportionTargetExpense && apportionTargetExpense.expenseDate) {
      const expenseDayStr = new Date(apportionTargetExpense.expenseDate).toISOString().split('T')[0]
      if (apportionDueDate < expenseDayStr) {
        setApportionError('Son ödeme tarihi gider tarihinden önce olamaz.')
        return null
      }
    }

    if (apportionMode !== 'EQUAL_SCOPE' && selectedUnitIds.length === 0) {
      setApportionError('Lütfen en az bir daire seçin.')
      return null
    }

    let manualList: ManualUnitApportionmentItem[] | undefined
    if (apportionMode === 'MANUAL_SELECTED') {
      manualList = []
      for (const uId of selectedUnitIds) {
        const valStr = manualAmounts[uId] || '0'
        const valNum = Number.parseFloat(valStr.replace(',', '.'))
        if (Number.isNaN(valNum) || valNum <= 0) {
          setApportionError(`Lütfen seçilen tüm daireler için 0'dan büyük tutar girin.`)
          return null
        }
        manualList.push({ unitId: uId, amount: valNum })
      }
    }

    return {
      mode: apportionMode,
      selectedUnitIds: apportionMode !== 'EQUAL_SCOPE' ? selectedUnitIds : undefined,
      manualUnitApportionments: manualList,
      dueDate: new Date(apportionDueDate).toISOString(),
    }
  }

  // Request Apportionment Preview
  const handleRequestPreview = async () => {
    if (!apportionTargetExpense) return
    setApportionError('')
    const payload = buildApportionPayload()
    if (!payload) return

    setIsPreviewLoading(true)
    try {
      const data = await getApportionmentPreview(apportionTargetExpense.id, payload)
      setPreviewData(data)
    } catch (err) {
      setApportionError(err instanceof Error ? err.message : 'Önizleme alınamadı.')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // Confirm Final Apportionment
  const handleConfirmApportion = async () => {
    if (!apportionTargetExpense) return
    setApportionError('')
    const payload = buildApportionPayload()
    if (!payload) return

    setIsApportioning(true)
    try {
      await apportionExpense(apportionTargetExpense.id, payload)
      showToast('Gider başarıyla dairelere borçlandırıldı.')
      setApportionTargetExpense(null)
      setPreviewData(null)
      void loadExpenseList()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Borçlandırma tamamlanamadı.'
      setApportionError(msg)
      showToast(msg)
    } finally {
      setIsApportioning(false)
    }
  }

  // Calculated manual total for frontend feedback
  const calculatedManualTotal = useMemo(() => {
    return selectedUnitIds.reduce((sum, uId) => {
      const val = Number.parseFloat((manualAmounts[uId] || '0').replace(',', '.'))
      return sum + (Number.isNaN(val) ? 0 : val)
    }, 0)
  }, [selectedUnitIds, manualAmounts])

  const activeFilterCount = [
    propertyFilter !== 'all',
    buildingFilter !== 'all',
    categoryFilter !== 'all',
    statusFilter !== 'all',
    Boolean(searchQuery.trim()),
  ].filter(Boolean).length

  return (
    <div className="section-container entity-management-view">
      <PageHeader
        eyebrow="Yönetim Paneli"
        title="Giderler ve Borçlandırma"
        subtitle="Gider kayıtları oluşturun ve dairelere borçlandırma modlarıyla dağıtın."
        meta={!isLoading && !listError ? `${filteredExpenses.length} gider gösteriliyor.` : 'Ortak alan giderlerini yönetin.'}
        action={(
          <button type="button" className="primary-button" onClick={handleOpenCreateDrawer}>
            Yeni Gider
          </button>
        )}
      />

      {/* Standard Entity Toolbar */}
      <section className="panel entity-toolbar exp-toolbar" aria-label="Gider filtreleri">
        <div className="form-field">
          <label htmlFor="exp-prop-filter">Gayrimenkul</label>
          <select
            id="exp-prop-filter"
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
          <label htmlFor="exp-bldg-filter">Blok</label>
          <select
            id="exp-bldg-filter"
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
          <label htmlFor="exp-cat-filter">Kategori</label>
          <select
            id="exp-cat-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Tüm Kategoriler</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="exp-status-filter">Durum</label>
          <select
            id="exp-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="unapportioned">Borçlandırılmadı (Taslak)</option>
            <option value="apportioned">Borçlandırıldı</option>
            <option value="cancelled">İptal Edildi</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="exp-search-input">Arama</label>
          <input
            id="exp-search-input"
            type="text"
            placeholder="Başlık, tedarikçi, belge no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          type="button"
          className={`secondary-button entity-filter-clear ${activeFilterCount > 0 ? 'has-active-filters' : ''}`}
          disabled={activeFilterCount === 0}
          onClick={() => { setPropertyFilter('all'); setBuildingFilter('all'); setCategoryFilter('all'); setStatusFilter('all'); setSearchQuery('') }}
        >
          <span>Filtreleri Temizle</span>
          {activeFilterCount > 0 && <span className="filter-count-badge" aria-label={`${activeFilterCount} aktif filtre`}>{activeFilterCount}</span>}
        </button>
      </section>

      {/* Main Content: Standardized Management Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : listError ? (
        <div className="panel status-message error-message">
          <p>{listError}</p>
          <button type="button" className="secondary-button" style={{ marginTop: '8px' }} onClick={() => { void loadExpenseList() }}>
            Tekrar Dene
          </button>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="panel status-message" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Kayıtlı gider bulunamadı.</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
            Filtrelerinizi değiştirebilir veya yeni bir gider kaydı ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Gider</th>
                  <th>Kapsam</th>
                  <th>Kategori</th>
                  <th className="text-right">Tutar</th>
                  <th>Gider Tarihi</th>
                  <th>Satıcı / Belge</th>
                  <th style={{ textAlign: 'center' }}>Durum</th>
                  <th className="text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((item) => {
                  const catObj = EXPENSE_CATEGORIES.find((c) => c.value === item.category)
                  const categoryLabel = catObj ? catObj.label : item.category

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>{item.title}</strong>
                        {item.description && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                          {item.buildingName ? `${item.propertyName} · ${item.buildingName}` : `${item.propertyName} · Site Geneli`}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          {categoryLabel}
                        </span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary)' }}>
                        {formatCurrency(item.amount)}
                      </td>
                      <td>
                        <span>{formatDate(item.expenseDate)}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>
                          {item.vendorName || '—'}
                        </div>
                        {item.documentNumber && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            Belge No: {item.documentNumber}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="due-status-wrapper">
                          {item.isCancelled ? (
                            <span className="status-badge inactive" title={item.cancelReason || ''}>
                              İptal Edildi
                            </span>
                          ) : item.isApportioned ? (
                            <>
                              <span className="status-badge active">
                                Borçlandırıldı
                              </span>
                              <span className="due-period-subtext">
                                {item.apportionedChargeCount} Daire
                              </span>
                            </>
                          ) : (
                            <span className="status-badge warning">
                              Borçlandırılmadı
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        {!item.isCancelled && !item.isApportioned ? (
                          <RowActionsMenu
                            label={item.title}
                            primaryAction={{
                              label: 'Dairelere Yansıt',
                              variant: 'primary',
                              onSelect: () => { void handleOpenApportionModal(item) },
                            }}
                            secondaryActions={[
                              {
                                label: 'Düzenle',
                                onSelect: () => handleOpenEditDrawer(item),
                              },
                              {
                                label: 'Gideri İptal Et',
                                onSelect: () => {
                                  setCancelTargetExpense(item)
                                  setCancelReason('')
                                  setCancelError('')
                                },
                                danger: true,
                              },
                            ]}
                          />
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Drawer for Create / Edit Expense */}
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
                <p className="eyebrow">Gider Yönetimi</p>
                <h2>{editingExpense ? 'Gider Kaydını Düzenle' : 'Yeni Gider Kaydı'}</h2>
                <p className="drawer-description">Ortak alan gider tutarlarını ve fatura bilgilerini kaydedin.</p>
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
                <label htmlFor="form-exp-prop">
                  Gayrimenkul / Site *
                </label>
                <select
                  id="form-exp-prop"
                  value={formPropertyId}
                  disabled={Boolean(editingExpense)}
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
                <label htmlFor="form-exp-bldg">Bina / Blok (Opsiyonel)</label>
                <select
                  id="form-exp-bldg"
                  value={formBuildingId || ''}
                  disabled={Boolean(editingExpense)}
                  onChange={(e) => setFormBuildingId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Tüm Bloklar (Site Geneli)</option>
                  {formBuildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <small className="field-help">
                  {editingExpense ? 'Gayrimenkul ve Blok kapsamı oluşturma sonrasında değiştirilemez.' : 'Blok seçilmezse gider tüm site geneline uygulanır.'}
                </small>
              </div>

              {/* Title */}
              <div className="form-field form-field-full">
                <label htmlFor="form-exp-title">
                  Gider Başlığı *
                </label>
                <input
                  id="form-exp-title"
                  type="text"
                  maxLength={150}
                  placeholder="Örn: Asansör Yıllık Bakım Ücreti"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              {/* Category */}
              <div className="form-field form-field-full">
                <label htmlFor="form-exp-cat">
                  Kategori *
                </label>
                <select
                  id="form-exp-cat"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  required
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="form-field form-field-full">
                <label htmlFor="form-exp-amount">
                  Tutar (₺) *
                </label>
                <input
                  id="form-exp-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                />
              </div>

              {/* Expense Date */}
              <div className="form-field form-field-full">
                <label htmlFor="form-exp-date">
                  Gider Tarihi *
                </label>
                <input
                  id="form-exp-date"
                  type="date"
                  value={formExpenseDate}
                  onChange={(e) => setFormExpenseDate(e.target.value)}
                  required
                />
              </div>

              {/* Document Number */}
              <div className="form-field form-field-full">
                <label htmlFor="form-exp-doc">Belge / Fatura No</label>
                <input
                  id="form-exp-doc"
                  type="text"
                  maxLength={100}
                  placeholder="Örn: FTR-2026-0881"
                  value={formDocumentNumber}
                  onChange={(e) => setFormDocumentNumber(e.target.value)}
                />
              </div>

              {/* Vendor Name */}
              <div className="form-field form-field-full">
                <label htmlFor="form-exp-vendor">Firma / Tedarikçi</label>
                <input
                  id="form-exp-vendor"
                  type="text"
                  maxLength={150}
                  placeholder="Örn: Otis Asansör A.Ş."
                  value={formVendorName}
                  onChange={(e) => setFormVendorName(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="form-field form-field-full">
                <label htmlFor="form-exp-desc">Açıklama</label>
                <textarea
                  id="form-exp-desc"
                  rows={3}
                  maxLength={500}
                  placeholder="Gider hakkında detaylı açıklama..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
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
                  <span>{isSubmitting ? 'Kaydediliyor...' : editingExpense ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTargetExpense && (
        <div className="confirmation-overlay" role="presentation">
          <div className="confirmation-dialog" style={{ maxWidth: '460px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
              Gider Kaydını İptal Et
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              "{cancelTargetExpense.title}" gider kaydını iptal etmek üzeresiniz. Lütfen bir gerekçe girin.
            </p>

            <form onSubmit={(e) => { void handleSubmitCancel(e) }}>
              {cancelError && (
                <div className="status-message error-message" style={{ marginBottom: '12px' }}>
                  {cancelError}
                </div>
              )}

              <div className="form-field" style={{ marginBottom: '20px' }}>
                <label htmlFor="cancel-exp-reason">
                  İptal Gerekçesi *
                </label>
                <textarea
                  id="cancel-exp-reason"
                  rows={3}
                  maxLength={500}
                  placeholder="İptal gerekçesini açıklayın..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                />
              </div>

              <div className="confirmation-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setCancelTargetExpense(null)}
                  disabled={isCancelling}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="action-button danger-btn"
                  disabled={isCancelling}
                >
                  <span>{isCancelling ? 'İptal Ediliyor...' : 'İptal Et'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* "Dairelere Yansıt" Apportionment Modal */}
      {apportionTargetExpense && (
        <div className="confirmation-overlay" role="presentation">
          <div className="confirmation-dialog" style={{ maxWidth: '640px', width: '92vw' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: 'var(--color-text-primary)' }}>
              Gideri Dairelere Yansıt (Borçlandırma)
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              "{apportionTargetExpense.title}" ({formatCurrency(apportionTargetExpense.amount)}) gider kaydını daire sakinlerine borçlandırın.
            </p>

            {apportionError && (
              <div className="status-message error-message" style={{ marginBottom: '16px' }}>
                {apportionError}
              </div>
            )}

            {/* Step 1: Distribution Mode Selection */}
            <div className="form-field" style={{ marginBottom: '16px' }}>
              <label htmlFor="apportion-mode-select">Dağıtım Yöntemi *</label>
              <select
                id="apportion-mode-select"
                value={apportionMode}
                onChange={(e) => {
                  setApportionMode(e.target.value as 'EQUAL_SCOPE' | 'EQUAL_SELECTED' | 'MANUAL_SELECTED')
                  setPreviewData(null)
                  setApportionError('')
                }}
              >
                <option value="EQUAL_SCOPE">Kapsamdaki tüm aktif dairelere eşit dağıt</option>
                <option value="EQUAL_SELECTED">Seçilen dairelere eşit dağıt</option>
                <option value="MANUAL_SELECTED">Seçilen dairelere manuel tutar gir</option>
              </select>
            </div>

            {/* Due Date Input */}
            <div className="form-field" style={{ marginBottom: '16px' }}>
              <label htmlFor="apportion-due-date">Son Ödeme Tarihi *</label>
              <input
                id="apportion-due-date"
                type="date"
                min={apportionTargetExpense.expenseDate ? new Date(apportionTargetExpense.expenseDate).toISOString().split('T')[0] : undefined}
                value={apportionDueDate}
                onChange={(e) => {
                  setApportionDueDate(e.target.value)
                  setPreviewData(null)
                  setApportionError('')
                }}
                required
              />
            </div>

            {/* Unit Selection Checklist for EQUAL_SELECTED / MANUAL_SELECTED */}
            {apportionMode !== 'EQUAL_SCOPE' && (
              <div style={{ marginBottom: '20px', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', background: 'var(--color-surface-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Daire Seçimi ({selectedUnitIds.length} Seçili)
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                      onClick={() => {
                        setSelectedUnitIds(availableUnits.map((u) => u.id))
                        setPreviewData(null)
                      }}
                    >
                      Tümünü Seç
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                      onClick={() => {
                        setSelectedUnitIds([])
                        setPreviewData(null)
                      }}
                    >
                      Temizle
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Daire no veya blok ara..."
                  value={unitSearchQuery}
                  onChange={(e) => setUnitSearchQuery(e.target.value)}
                  style={{ marginBottom: '10px', height: '34px', fontSize: '0.8rem' }}
                />

                {isLoadingUnits ? (
                  <LoadingSkeleton variant="table" rows={3} />
                ) : filteredAvailableUnits.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Daire bulunamadı.</p>
                ) : (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {filteredAvailableUnits.map((u) => {
                      const isChecked = selectedUnitIds.includes(u.id)
                      return (
                        <div
                          key={u.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'var(--color-surface)',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(evt) => {
                                setPreviewData(null)
                                if (evt.target.checked) {
                                  setSelectedUnitIds((prev) => [...prev, u.id])
                                } else {
                                  setSelectedUnitIds((prev) => prev.filter((id) => id !== u.id))
                                }
                              }}
                            />
                            <span>{u.buildingName} · No: {u.unitNumber}</span>
                          </label>

                          {apportionMode === 'MANUAL_SELECTED' && isChecked && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>₺</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={manualAmounts[u.id] || ''}
                                onChange={(evt) => {
                                  setPreviewData(null)
                                  setManualAmounts({ ...manualAmounts, [u.id]: evt.target.value })
                                }}
                                style={{ width: '90px', height: '30px', padding: '0 6px', fontSize: '0.8rem' }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {apportionMode === 'MANUAL_SELECTED' && (
                  <div style={{ marginTop: '10px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: calculatedManualTotal === apportionTargetExpense.amount ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    <span>Manuel Girilen Toplam:</span>
                    <strong>{formatCurrency(calculatedManualTotal)} / {formatCurrency(apportionTargetExpense.amount)}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Preview Section */}
            {previewData && (
              <div style={{ background: 'var(--color-surface-secondary)', padding: '14px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Hedef Daire Sayısı:</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{previewData.targetUnitCount} Daire</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Toplam Yansıtılan:</span>
                  <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(previewData.totalAllocatedAmount)}</strong>
                </div>

                {previewData.items && previewData.items.length > 0 && (
                  <div style={{ maxHeight: '140px', overflowY: 'auto', marginTop: '10px', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                    <table style={{ width: '100%', fontSize: '0.78rem' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Daire</th>
                          <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.items.map((item) => (
                          <tr key={item.unitId}>
                            <td>{item.buildingName} · No: {item.unitNumber}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="confirmation-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setApportionTargetExpense(null)}
                disabled={isApportioning || isPreviewLoading}
              >
                Kapat
              </button>

              {!previewData ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isPreviewLoading}
                  onClick={() => { void handleRequestPreview() }}
                >
                  <span>{isPreviewLoading ? 'Önizleme Alınıyor...' : 'Önizle'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  disabled={isApportioning}
                  onClick={() => { void handleConfirmApportion() }}
                >
                  <span>{isApportioning ? 'Kesinleştiriliyor...' : 'Borçlandırmayı Kesinleştir'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
