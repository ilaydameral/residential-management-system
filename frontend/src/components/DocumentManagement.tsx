import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  downloadDocument,
  getBuildingsByProperty,
  getDocument,
  getDocuments,
  getProperties,
  getUnitsByBuilding,
  setDocumentStatus,
  updateDocumentMetadata,
  uploadDocument,
} from '../api'
import type {
  Building,
  DocumentCategory,
  DocumentDetail,
  DocumentTargetType,
  DocumentVisibility,
  ManagedDocument,
  Property,
  Unit,
} from '../types'
import { useToast } from '../context/ToastContext'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'
import { PageHeader } from './PageHeader'
import { RowActionsMenu } from './RowActionsMenu'
import { SaveShortcutHint } from './SaveShortcutHint'

const PAGE_SIZE = 15
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx']

const CATEGORY_OPTIONS: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'GENERAL', label: 'Genel' },
  { value: 'MANAGEMENT', label: 'Yönetim' },
  { value: 'FINANCE', label: 'Finans' },
  { value: 'MEETING', label: 'Toplantı' },
  { value: 'MAINTENANCE', label: 'Bakım' },
  { value: 'LEGAL', label: 'Hukuki' },
  { value: 'TECHNICAL', label: 'Teknik' },
  { value: 'OTHER', label: 'Diğer' },
]

const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map((item) => [item.value, item.label])) as Record<DocumentCategory, string>
const VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  MANAGEMENT_ONLY: 'Yalnızca Yönetim',
  RESIDENTS: 'Sakinlerle Paylaşılır',
}
const TARGET_LABELS: Record<DocumentTargetType, string> = {
  PROPERTY: 'Yapı',
  BUILDING: 'Blok / Bina',
  UNIT: 'Daire / Bölüm',
}

type DrawerMode = 'upload' | 'detail' | 'edit' | null

interface UploadFormState {
  targetType: DocumentTargetType
  propertyId: number
  buildingId: number
  unitId: number
  title: string
  description: string
  category: DocumentCategory
  visibility: DocumentVisibility
  file: File | null
}

interface EditFormState {
  title: string
  description: string
  category: DocumentCategory
  visibility: DocumentVisibility
}

const initialUploadForm: UploadFormState = {
  targetType: 'PROPERTY',
  propertyId: 0,
  buildingId: 0,
  unitId: 0,
  title: '',
  description: '',
  category: 'GENERAL',
  visibility: 'MANAGEMENT_ONLY',
  file: null,
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function targetText(document: ManagedDocument): string {
  if (document.targetType === 'PROPERTY') return document.propertyName
  if (document.targetType === 'BUILDING') return `${document.propertyName} / ${document.buildingName ?? 'Blok'}`
  return `${document.propertyName} / ${document.buildingName ?? 'Blok'} / ${document.unitNumber ?? 'Daire'}`
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function DocumentManagement({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const { showToast } = useToast()
  const [documents, setDocuments] = useState<ManagedDocument[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [properties, setProperties] = useState<Property[]>([])
  const [filterBuildings, setFilterBuildings] = useState<Building[]>([])
  const [filterUnits, setFilterUnits] = useState<Unit[]>([])
  const [propertyFilter, setPropertyFilter] = useState<number | 'all'>('all')
  const [buildingFilter, setBuildingFilter] = useState<number | 'all'>('all')
  const [unitFilter, setUnitFilter] = useState<number | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<DocumentVisibility | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active')
  const [search, setSearch] = useState('')

  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadForm, setUploadForm] = useState<UploadFormState>(initialUploadForm)
  const [editForm, setEditForm] = useState<EditFormState>({
    title: '', description: '', category: 'GENERAL', visibility: 'MANAGEMENT_ONLY',
  })
  const [formBuildings, setFormBuildings] = useState<Building[]>([])
  const [formUnits, setFormUnits] = useState<Unit[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [statusTarget, setStatusTarget] = useState<ManagedDocument | null>(null)
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false)

  const isUploadDirty = drawerMode === 'upload' && (
    uploadForm.propertyId > 0 || uploadForm.title.trim() !== '' || uploadForm.description.trim() !== '' ||
    uploadForm.category !== 'GENERAL' || uploadForm.visibility !== 'MANAGEMENT_ONLY' || uploadForm.file !== null
  )
  const isEditDirty = drawerMode === 'edit' && selectedDocument !== null && (
    editForm.title !== selectedDocument.title ||
    editForm.description !== (selectedDocument.description ?? '') ||
    editForm.category !== selectedDocument.category ||
    editForm.visibility !== selectedDocument.visibility
  )
  const isDirty = isUploadDirty || isEditDirty
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isDirty)

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const isDrawerOpen = drawerMode !== null
  const drawerAnimation = useAnimatedDrawer(isDrawerOpen)

  const finishCloseDrawer = useCallback(() => {
    setDrawerMode(null)
    setSelectedDocument(null)
    setDrawerError('')
    setUploadForm(initialUploadForm)
    setFormBuildings([])
    setFormUnits([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const closeDrawer = useCallback(() => {
    drawerAnimation.close(finishCloseDrawer)
  }, [drawerAnimation, finishCloseDrawer])

  const requestCloseDrawer = useCallback(async () => {
    if (isSubmitting) return
    if (await requestDiscard()) closeDrawer()
  }, [closeDrawer, isSubmitting, requestDiscard])

  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.shouldRender,
    onClose: closeDrawer,
    onRequestClose: () => { void requestCloseDrawer() },
    enableSaveShortcut: drawerMode !== 'detail',
    isSaving: isSubmitting,
  })

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const result = await getDocuments({
        propertyId: typeof propertyFilter === 'number' ? propertyFilter : undefined,
        buildingId: typeof buildingFilter === 'number' ? buildingFilter : undefined,
        unitId: typeof unitFilter === 'number' ? unitFilter : undefined,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        visibility: visibilityFilter === 'all' ? undefined : visibilityFilter,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        search: search.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setDocuments(result.items)
      setTotalCount(result.totalCount)
    } catch (error) {
      setDocuments([])
      setTotalCount(0)
      setLoadError(error instanceof Error ? error.message : 'Belgeler yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [buildingFilter, categoryFilter, page, propertyFilter, search, statusFilter, unitFilter, visibilityFilter])

  useEffect(() => { void fetchDocuments() }, [fetchDocuments])

  useEffect(() => {
    getProperties(false)
      .then((items) => setProperties(items.filter((item) => item.isActive)))
      .catch(() => setProperties([]))
  }, [])

  useEffect(() => {
    if (typeof propertyFilter !== 'number') {
      setFilterBuildings([])
      setBuildingFilter('all')
      setFilterUnits([])
      setUnitFilter('all')
      return
    }
    getBuildingsByProperty(propertyFilter, false)
      .then((items) => setFilterBuildings(items.filter((item) => item.isActive)))
      .catch(() => setFilterBuildings([]))
  }, [propertyFilter])

  useEffect(() => {
    if (typeof buildingFilter !== 'number') {
      setFilterUnits([])
      setUnitFilter('all')
      return
    }
    getUnitsByBuilding(buildingFilter, false)
      .then((items) => setFilterUnits(items.filter((item) => item.isActive)))
      .catch(() => setFilterUnits([]))
  }, [buildingFilter])

  const activeFilterCount = [
    propertyFilter !== 'all', buildingFilter !== 'all', unitFilter !== 'all', categoryFilter !== 'all',
    visibilityFilter !== 'all', statusFilter !== 'active', Boolean(search.trim()),
  ].filter(Boolean).length

  const clearFilters = () => {
    setPropertyFilter('all')
    setBuildingFilter('all')
    setUnitFilter('all')
    setCategoryFilter('all')
    setVisibilityFilter('all')
    setStatusFilter('active')
    setSearch('')
    setPage(1)
  }

  const openUpload = () => {
    setUploadForm(initialUploadForm)
    setFormBuildings([])
    setFormUnits([])
    setDrawerError('')
    setDrawerMode('upload')
  }

  const loadFormBuildings = async (propertyId: number) => {
    if (!propertyId) {
      setFormBuildings([])
      return
    }
    try {
      const items = await getBuildingsByProperty(propertyId, false)
      setFormBuildings(items.filter((item) => item.isActive))
    } catch {
      setFormBuildings([])
      setDrawerError('Seçilen yapının blokları yüklenemedi.')
    }
  }

  const loadFormUnits = async (buildingId: number) => {
    if (!buildingId) {
      setFormUnits([])
      return
    }
    try {
      const items = await getUnitsByBuilding(buildingId, false)
      setFormUnits(items.filter((item) => item.isActive))
    } catch {
      setFormUnits([])
      setDrawerError('Seçilen bloğun daireleri yüklenemedi.')
    }
  }

  const openDetail = async (item: ManagedDocument) => {
    setSelectedDocument(item)
    setDrawerError('')
    setDrawerMode('detail')
    setIsDetailLoading(true)
    try {
      setSelectedDocument(await getDocument(item.id))
    } catch (error) {
      setDrawerError(error instanceof Error ? error.message : 'Belge detayı yüklenemedi.')
    } finally {
      setIsDetailLoading(false)
    }
  }

  const openEdit = (item: DocumentDetail) => {
    setEditForm({
      title: item.title,
      description: item.description ?? '',
      category: item.category,
      visibility: item.visibility,
    })
    setDrawerError('')
    setDrawerMode('edit')
  }

  const validateFile = (file: File): string | null => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_EXTENSIONS.includes(extension)) return 'Yalnızca PDF, JPG, PNG, DOCX ve XLSX dosyaları yüklenebilir.'
    if (file.size <= 0) return 'Boş dosya yüklenemez.'
    if (file.size > MAX_FILE_SIZE) return 'Dosya boyutu 10 MB sınırını aşamaz.'
    return null
  }

  const submitUpload = async (event: FormEvent) => {
    event.preventDefault()
    setDrawerError('')
    const { targetType, propertyId, buildingId, unitId, title, file } = uploadForm
    if (!propertyId || !title.trim() || !file) {
      setDrawerError('Yapı, başlık ve dosya alanları zorunludur.')
      return
    }
    if (targetType !== 'PROPERTY' && !buildingId) {
      setDrawerError('Blok veya bina seçilmelidir.')
      return
    }
    if (targetType === 'UNIT' && !unitId) {
      setDrawerError('Daire veya bölüm seçilmelidir.')
      return
    }
    const fileError = validateFile(file)
    if (fileError) {
      setDrawerError(fileError)
      return
    }

    setIsSubmitting(true)
    try {
      await uploadDocument({
        propertyId,
        buildingId: targetType === 'PROPERTY' ? null : buildingId,
        unitId: targetType === 'UNIT' ? unitId : null,
        title: title.trim(),
        description: uploadForm.description.trim() || null,
        category: uploadForm.category,
        visibility: uploadForm.visibility,
        file,
      })
      showToast('Belge yüklendi.')
      closeDrawer()
      await fetchDocuments()
    } catch (error) {
      setDrawerError(error instanceof Error ? error.message : 'Belge yüklenemedi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedDocument || !editForm.title.trim()) {
      setDrawerError('Belge başlığı zorunludur.')
      return
    }
    setIsSubmitting(true)
    setDrawerError('')
    try {
      const updated = await updateDocumentMetadata(selectedDocument.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        category: editForm.category,
        visibility: editForm.visibility,
      })
      setSelectedDocument(updated)
      setDrawerMode('detail')
      showToast('Belge bilgileri güncellendi.')
      await fetchDocuments()
    } catch (error) {
      setDrawerError(error instanceof Error ? error.message : 'Belge bilgileri güncellenemedi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownload = async (item: ManagedDocument) => {
    try {
      const result = await downloadDocument(item.id)
      triggerBlobDownload(result.blob, result.fileName || item.originalFileName)
      showToast('Belge indirme işlemi başlatıldı.', 'info')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Belge indirilemedi.', 'error')
    }
  }

  const confirmStatusChange = async () => {
    if (!statusTarget || isStatusSubmitting) return
    setIsStatusSubmitting(true)
    try {
      const updated = await setDocumentStatus(statusTarget.id, { isActive: !statusTarget.isActive })
      showToast(updated.isActive ? 'Belge yeniden aktifleştirildi.' : 'Belge arşivlendi.')
      setStatusTarget(null)
      if (selectedDocument?.id === updated.id) setSelectedDocument(updated)
      await fetchDocuments()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Belge durumu güncellenemedi.', 'error')
    } finally {
      setIsStatusSubmitting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const isFilteredEmpty = totalCount === 0 && activeFilterCount > 0
  const drawerTitle = drawerMode === 'upload' ? 'Belge Yükle' : drawerMode === 'edit' ? 'Belge Bilgilerini Düzenle' : 'Belge Detayı'
  const drawerDescription = drawerMode === 'upload'
    ? 'Belgeyi güvenli bir hedef ve görünürlük kapsamında kaydedin.'
    : drawerMode === 'edit'
      ? 'Dosya ve hedef değişmeden belge metadatasını güncelleyin.'
      : 'Belgenin kapsamını, dosya bilgisini ve yaşam döngüsünü inceleyin.'

  const detailRows = useMemo(() => selectedDocument ? [
    ['Hedef', targetText(selectedDocument)],
    ['Kategori', CATEGORY_LABELS[selectedDocument.category]],
    ['Görünürlük', VISIBILITY_LABELS[selectedDocument.visibility]],
    ['Dosya', selectedDocument.originalFileName],
    ['Boyut', formatFileSize(selectedDocument.fileSize)],
    ['Yükleyen', selectedDocument.uploadedByName],
    ['Yüklenme Tarihi', formatDate(selectedDocument.uploadedAt)],
    ['Son Güncelleme', formatDate(selectedDocument.updatedAt)],
  ] : [], [selectedDocument])

  return (
    <div className="management-page document-management-page">
      <PageHeader
        eyebrow="Yönetim Paneli"
        title="Belgeler"
        subtitle="Yapı, blok ve dairelere ait operasyonel belgeleri güvenli biçimde yönetin."
        meta={`${totalCount} belge gösteriliyor.`}
        action={<button className="primary-button" type="button" onClick={openUpload}>Belge Yükle</button>}
      />

      <section className="panel entity-toolbar document-toolbar" aria-label="Belge filtreleri">
        <div className="form-field document-search-field">
          <label htmlFor="document-search">Belge Ara</label>
          <input id="document-search" value={search} placeholder="Başlık, açıklama veya dosya adı" onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
        </div>
        <div className="form-field">
          <label htmlFor="document-property-filter">Yapı</label>
          <select id="document-property-filter" value={propertyFilter} onChange={(event) => { const value = event.target.value; setPropertyFilter(value === 'all' ? 'all' : Number(value)); setBuildingFilter('all'); setUnitFilter('all'); setPage(1) }}>
            <option value="all">Tüm yapılar</option>
            {properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="document-building-filter">Blok / Bina</label>
          <select id="document-building-filter" value={buildingFilter} disabled={propertyFilter === 'all'} onChange={(event) => { const value = event.target.value; setBuildingFilter(value === 'all' ? 'all' : Number(value)); setUnitFilter('all'); setPage(1) }}>
            <option value="all">{propertyFilter === 'all' ? 'Önce yapı seçin' : 'Tüm bloklar'}</option>
            {filterBuildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="document-unit-filter">Daire / Bölüm</label>
          <select id="document-unit-filter" value={unitFilter} disabled={buildingFilter === 'all'} onChange={(event) => { const value = event.target.value; setUnitFilter(value === 'all' ? 'all' : Number(value)); setPage(1) }}>
            <option value="all">{buildingFilter === 'all' ? 'Önce blok seçin' : 'Tüm daireler'}</option>
            {filterUnits.map((item) => <option key={item.id} value={item.id}>{item.unitNumber}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="document-category-filter">Kategori</label>
          <select id="document-category-filter" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value as DocumentCategory | 'all'); setPage(1) }}>
            <option value="all">Tüm kategoriler</option>
            {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="document-visibility-filter">Görünürlük</label>
          <select id="document-visibility-filter" value={visibilityFilter} onChange={(event) => { setVisibilityFilter(event.target.value as DocumentVisibility | 'all'); setPage(1) }}>
            <option value="all">Tüm görünürlükler</option>
            <option value="MANAGEMENT_ONLY">Yalnızca Yönetim</option>
            <option value="RESIDENTS">Sakinlerle Paylaşılır</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="document-status-filter">Durum</label>
          <select id="document-status-filter" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1) }}>
            <option value="active">Aktif</option>
            <option value="archived">Arşivlenmiş</option>
            <option value="all">Tüm durumlar</option>
          </select>
        </div>
        <button className={`secondary-button entity-filter-clear ${activeFilterCount ? 'has-active-filters' : ''}`} type="button" disabled={!activeFilterCount} onClick={clearFilters}>
          <span>Filtreleri Temizle</span>
          {activeFilterCount > 0 && <span className="filter-count-badge" aria-label={`${activeFilterCount} aktif filtre`}>{activeFilterCount}</span>}
        </button>
      </section>

      {isLoading ? <LoadingSkeleton variant="table" rows={6} /> : loadError ? (
        <section className="panel entity-state-panel error-state" role="alert">
          <p className="status-message error-message">{loadError}</p>
          <button className="secondary-button" type="button" onClick={() => void fetchDocuments()}>Tekrar Dene</button>
        </section>
      ) : documents.length === 0 ? (
        <section className="panel entity-state-panel actionable-empty-state">
          <h2>{isFilteredEmpty ? 'Filtrelerle eşleşen belge bulunamadı.' : 'Henüz belge bulunmuyor.'}</h2>
          <p>{isFilteredEmpty ? 'Filtreleri temizleyerek tüm belgeleri görüntüleyebilirsiniz.' : 'İlk operasyonel belgeyi güvenli kapsamıyla yükleyebilirsiniz.'}</p>
          <button className={isFilteredEmpty ? 'secondary-button' : 'primary-button'} type="button" onClick={isFilteredEmpty ? clearFilters : openUpload}>
            {isFilteredEmpty ? 'Filtreleri Temizle' : 'Belge Yükle'}
          </button>
        </section>
      ) : (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table document-management-table">
              <thead><tr><th>Başlık</th><th>Hedef</th><th>Kategori</th><th>Görünürlük</th><th>Dosya</th><th>Boyut</th><th>Yüklenme</th><th>Durum</th><th>İşlemler</th></tr></thead>
              <tbody>{documents.map((item) => (
                <tr key={item.id}>
                  <td><strong className="document-title-cell" title={item.title}>{item.title}</strong></td>
                  <td><span className="document-target-cell">{targetText(item)}</span><small>{TARGET_LABELS[item.targetType]}</small></td>
                  <td><span className="status-badge secondary">{CATEGORY_LABELS[item.category]}</span></td>
                  <td><span className={`status-badge ${item.visibility === 'RESIDENTS' ? 'info' : 'inactive'}`}>{VISIBILITY_LABELS[item.visibility]}</span></td>
                  <td><span className="document-file-cell" title={item.originalFileName}>{item.originalFileName}</span></td>
                  <td>{formatFileSize(item.fileSize)}</td>
                  <td><span className="document-date-cell">{formatDate(item.uploadedAt)}</span></td>
                  <td><span className={`status-badge ${item.isActive ? 'active' : 'inactive'}`}>{item.isActive ? 'Aktif' : 'Arşivde'}</span></td>
                  <td><RowActionsMenu label={item.title} primaryAction={{ label: 'Detay', onSelect: () => { void openDetail(item) } }} secondaryActions={[
                    { label: 'İndir', onSelect: () => { void handleDownload(item) } },
                    { label: 'Düzenle', onSelect: () => { setSelectedDocument(item); openEdit(item) } },
                    { label: item.isActive ? 'Arşivle' : 'Yeniden Aktifleştir', danger: item.isActive, onSelect: () => setStatusTarget(item) },
                  ]} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {totalPages > 1 && !isLoading && !loadError && (
        <nav className="pagination" aria-label="Belge sayfaları">
          <button className="button outline small" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Önceki</button>
          <span>Sayfa {page} / {totalPages}</span>
          <button className="button outline small" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Sonraki</button>
        </nav>
      )}

      {drawerAnimation.shouldRender && drawerMode && (
        <>
          <button className={`drawer-backdrop drawer-${drawerAnimation.phase}`} type="button" aria-label={`${drawerTitle} panelini kapat`} onClick={() => void requestCloseDrawer()} />
          <aside ref={drawerRef} tabIndex={-1} className={`management-drawer document-drawer drawer-container drawer-${drawerAnimation.phase}`} role="dialog" aria-modal="true" aria-labelledby="document-drawer-title" aria-describedby="document-drawer-description">
            <div className="drawer-header">
              <div><p className="eyebrow">Belge Yönetimi</p><h2 id="document-drawer-title">{drawerTitle}</h2><p id="document-drawer-description" className="drawer-description">{drawerDescription}</p></div>
              <button className="drawer-close-button" type="button" aria-label="Kapat" disabled={isSubmitting} onClick={() => void requestCloseDrawer()}>×</button>
            </div>
            <div className="drawer-body">
              {drawerError && <p className="status-message error-message" role="alert">{drawerError}</p>}
              {drawerMode === 'upload' && (
                <form id="document-upload-form" className="drawer-form document-drawer-form" onSubmit={submitUpload}>
                  <div className="form-field form-field-full"><label htmlFor="document-target-type">Hedef Seviyesi *</label><select id="document-target-type" data-drawer-initial-focus value={uploadForm.targetType} onChange={(event) => { const targetType = event.target.value as DocumentTargetType; setUploadForm((current) => ({ ...current, targetType, buildingId: 0, unitId: 0 })); setFormUnits([]) }}><option value="PROPERTY">Yapı</option><option value="BUILDING">Blok / Bina</option><option value="UNIT">Daire / Bölüm</option></select></div>
                  <div className="form-field form-field-full"><label htmlFor="document-property">Yapı *</label><select id="document-property" value={uploadForm.propertyId || ''} required onChange={(event) => { const propertyId = Number(event.target.value); setUploadForm((current) => ({ ...current, propertyId, buildingId: 0, unitId: 0 })); setFormUnits([]); void loadFormBuildings(propertyId) }}><option value="">Yapı seçin</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                  {uploadForm.targetType !== 'PROPERTY' && <div className="form-field form-field-full"><label htmlFor="document-building">Blok / Bina *</label><select id="document-building" value={uploadForm.buildingId || ''} required disabled={!uploadForm.propertyId} onChange={(event) => { const buildingId = Number(event.target.value); setUploadForm((current) => ({ ...current, buildingId, unitId: 0 })); void loadFormUnits(buildingId) }}><option value="">Blok seçin</option>{formBuildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
                  {uploadForm.targetType === 'UNIT' && <div className="form-field form-field-full"><label htmlFor="document-unit">Daire / Bölüm *</label><select id="document-unit" value={uploadForm.unitId || ''} required disabled={!uploadForm.buildingId} onChange={(event) => setUploadForm((current) => ({ ...current, unitId: Number(event.target.value) }))}><option value="">Daire seçin</option>{formUnits.map((item) => <option key={item.id} value={item.id}>{item.unitNumber}</option>)}</select></div>}
                  <div className="form-field form-field-full"><label htmlFor="document-title">Başlık *</label><input id="document-title" value={uploadForm.title} maxLength={200} required onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))} /></div>
                  <div className="form-field form-field-full"><label htmlFor="document-description">Açıklama</label><textarea id="document-description" rows={4} maxLength={1000} value={uploadForm.description} onChange={(event) => setUploadForm((current) => ({ ...current, description: event.target.value }))} /></div>
                  <div className="form-field"><label htmlFor="document-category">Kategori *</label><select id="document-category" value={uploadForm.category} required onChange={(event) => setUploadForm((current) => ({ ...current, category: event.target.value as DocumentCategory }))}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                  <div className="form-field"><label htmlFor="document-visibility">Görünürlük *</label><select id="document-visibility" value={uploadForm.visibility} required onChange={(event) => setUploadForm((current) => ({ ...current, visibility: event.target.value as DocumentVisibility }))}><option value="MANAGEMENT_ONLY">Yalnızca Yönetim</option><option value="RESIDENTS">Sakinlerle Paylaşılır</option></select></div>
                  <div className="form-field form-field-full">
                    <label htmlFor="document-file">Dosya *</label>
                    <div className="custom-file-picker">
                      <input
                        ref={fileInputRef}
                        id="document-file"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                        required
                        className="custom-file-input-hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setUploadForm((current) => ({ ...current, file }))
                          setDrawerError(file ? validateFile(file) ?? '' : '')
                        }}
                      />
                      <div className="custom-file-picker-control">
                        <button
                          type="button"
                          className="secondary-button custom-file-picker-button"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Dosya Seç
                        </button>
                        <span
                          className={`custom-file-picker-filename ${uploadForm.file ? 'has-file' : 'empty'}`}
                          title={uploadForm.file?.name}
                        >
                          {uploadForm.file ? uploadForm.file.name : 'Dosya seçilmedi'}
                        </span>
                      </div>
                    </div>
                    <small className="field-help">PDF, JPG, PNG, DOCX veya XLSX — en fazla 10 MB.</small>
                  </div>
                </form>
              )}

              {drawerMode === 'edit' && selectedDocument && (
                <form id="document-edit-form" className="drawer-form document-drawer-form" onSubmit={submitEdit}>
                  <div className="drawer-info-box form-field-full"><strong>Hedef değiştirilemez</strong><span>{targetText(selectedDocument)}</span></div>
                  <div className="form-field form-field-full"><label htmlFor="document-edit-title">Başlık *</label><input id="document-edit-title" data-drawer-initial-focus value={editForm.title} maxLength={200} required onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} /></div>
                  <div className="form-field form-field-full"><label htmlFor="document-edit-description">Açıklama</label><textarea id="document-edit-description" rows={5} maxLength={1000} value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} /></div>
                  <div className="form-field"><label htmlFor="document-edit-category">Kategori *</label><select id="document-edit-category" value={editForm.category} onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value as DocumentCategory }))}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                  <div className="form-field"><label htmlFor="document-edit-visibility">Görünürlük *</label><select id="document-edit-visibility" value={editForm.visibility} onChange={(event) => setEditForm((current) => ({ ...current, visibility: event.target.value as DocumentVisibility }))}><option value="MANAGEMENT_ONLY">Yalnızca Yönetim</option><option value="RESIDENTS">Sakinlerle Paylaşılır</option></select></div>
                </form>
              )}

              {drawerMode === 'detail' && (isDetailLoading ? <LoadingSkeleton variant="detail" /> : selectedDocument && (
                <div className="document-detail-content">
                  <div className="document-detail-heading"><div><h3>{selectedDocument.title}</h3><p>{selectedDocument.description || 'Açıklama belirtilmemiş.'}</p></div><span className={`status-badge ${selectedDocument.isActive ? 'active' : 'inactive'}`}>{selectedDocument.isActive ? 'Aktif' : 'Arşivde'}</span></div>
                  <dl className="document-detail-grid">{detailRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                  {!selectedDocument.isActive && <section className="document-archive-box"><h4>Arşiv Bilgisi</h4><p>{formatDate(selectedDocument.archivedAt)} · {selectedDocument.archivedByName || 'Kullanıcı bilgisi yok'}</p></section>}
                </div>
              ))}
            </div>
            <div className="drawer-footer">
              {drawerMode === 'upload' && <><SaveShortcutHint /><button className="secondary-button" type="button" disabled={isSubmitting} onClick={() => void requestCloseDrawer()}>Vazgeç</button><button className="primary-button" type="submit" form="document-upload-form" disabled={isSubmitting}>{isSubmitting ? 'Yükleniyor...' : 'Belgeyi Yükle'}</button></>}
              {drawerMode === 'edit' && <><SaveShortcutHint /><button className="secondary-button" type="button" disabled={isSubmitting} onClick={() => void requestCloseDrawer()}>Vazgeç</button><button className="primary-button" type="submit" form="document-edit-form" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</button></>}
              {drawerMode === 'detail' && selectedDocument && <><button className="secondary-button" type="button" onClick={() => void handleDownload(selectedDocument)}>İndir</button><button className="secondary-button" type="button" onClick={() => openEdit(selectedDocument)}>Düzenle</button><button className={selectedDocument.isActive ? 'button danger' : 'primary-button'} type="button" onClick={() => setStatusTarget(selectedDocument)}>{selectedDocument.isActive ? 'Arşivle' : 'Yeniden Aktifleştir'}</button></>}
            </div>
          </aside>
        </>
      )}

      {statusTarget && <ConfirmationDialog title={statusTarget.isActive ? 'Belgeyi Arşivle' : 'Belgeyi Yeniden Aktifleştir'} message={statusTarget.isActive ? 'Belge pasif duruma alınacak; fiziksel dosya güvenli biçimde korunmaya devam edecek.' : 'Belge yeniden aktif edilecek. Aynı dosya bu hedefte zaten aktifse işlem reddedilebilir.'} confirmLabel={statusTarget.isActive ? 'Arşivle' : 'Aktifleştir'} danger={statusTarget.isActive} isLoading={isStatusSubmitting} onCancel={() => setStatusTarget(null)} onConfirm={() => { void confirmStatusChange() }} />}
      {unsavedChangesDialog}
    </div>
  )
}
