import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  closeUnitOccupancy,
  createUnitOccupancy,
  getUnitOccupancies,
  searchUsers,
  updateUnitOccupancy,
} from '../api'
import type {
  CreateUnitOccupancyPayload,
  Unit,
  UnitOccupancy,
  UpdateUnitOccupancyPayload,
  UserSearchResult,
} from '../types'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'

interface OccupancyManagementProps {
  unit: Unit
  onClose: () => void
  onDirtyChange: (isDirty: boolean) => void
}

interface OccupancyFormState {
  occupancyTypeId: number
  startDate: string
  endDate: string
  isPrimary: boolean
  notes: string
}

const OCCUPANCY_TYPES = [
  { id: 1, code: 'OWNER', label: 'Malik' },
  { id: 2, code: 'TENANT', label: 'Kiracı' },
  { id: 3, code: 'HOUSEHOLD_MEMBER', label: 'Hane Üyesi' },
] as const

function getOccupancyTypeLabel(code: string): string {
  return OCCUPANCY_TYPES.find((type) => type.code === code)?.label ?? 'Bilinmeyen'
}

function todayAsInputDate(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createInitialForm(): OccupancyFormState {
  return {
    occupancyTypeId: 2,
    startDate: todayAsInputDate(),
    endDate: '',
    isPrimary: false,
    notes: '',
  }
}

function toStartOfDayUtcIso(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString()
}

function toEndOfDayUtcIso(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString()
}

function toInputDate(value: string | null): string {
  if (!value) return ''

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value: string | null): string {
  if (!value) return '—'

  const inputDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toInputDate(value)
  const match = inputDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '—'
}

type OccupancyStatus = 'Aktif' | 'Sonlandırılmış' | 'Pasif'

function getOccupancyStatus(occupancy: UnitOccupancy): OccupancyStatus {
  const today = todayAsInputDate()
  const startDate = toInputDate(occupancy.startDate)
  const endDate = toInputDate(occupancy.endDate)

  if (!occupancy.isActive) {
    return endDate ? 'Sonlandırılmış' : 'Pasif'
  }
  if (startDate > today) return 'Pasif'
  if (endDate && endDate < today) return 'Sonlandırılmış'
  return 'Aktif'
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function OccupancyManagement({ unit, onClose, onDirtyChange }: OccupancyManagementProps) {
  const [occupancies, setOccupancies] = useState<UnitOccupancy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [success, setSuccess] = useState('')

  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit' | 'close'>('none')
  const [form, setForm] = useState<OccupancyFormState>(createInitialForm)
  const [formBaseline, setFormBaseline] = useState<OccupancyFormState>(createInitialForm)
  const [editingOccupancy, setEditingOccupancy] = useState<UnitOccupancy | null>(null)
  const [closingOccupancy, setClosingOccupancy] = useState<UnitOccupancy | null>(null)
  const [closeDate, setCloseDate] = useState(todayAsInputDate())
  const [closeDateBaseline, setCloseDateBaseline] = useState(todayAsInputDate())

  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [userSearchError, setUserSearchError] = useState('')

  const editingRecordIsPast = Boolean(
    editingOccupancy && getOccupancyStatus(editingOccupancy) !== 'Aktif'
  )

  const isFormDirty =
    formMode === 'create'
      ? JSON.stringify(form) !== JSON.stringify(formBaseline) ||
        userQuery.trim() !== '' ||
        selectedUser !== null
      : formMode === 'edit'
        ? JSON.stringify(form) !== JSON.stringify(formBaseline)
        : formMode === 'close'
          ? closeDate !== closeDateBaseline
          : false

  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isFormDirty)

  const loadOccupancies = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const data = await getUnitOccupancies(unit.id, true)
      if (!Array.isArray(data)) {
        throw new Error('Sakin kayıtları beklenen biçimde alınamadı. Lütfen tekrar deneyin.')
      }
      setOccupancies(data)
    } catch (loadError) {
      setOccupancies([])
      setLoadError(getErrorMessage(loadError, 'Sakin kayıtları yüklenemedi.'))
    } finally {
      setIsLoading(false)
    }
  }, [unit.id])

  useEffect(() => {
    setFormMode('none')
    setEditingOccupancy(null)
    setClosingOccupancy(null)
    setSelectedUser(null)
    setUserQuery('')
    setUserResults([])
    setError('')
    setLoadError('')
    setSuccess('')
    void loadOccupancies()
  }, [loadOccupancies])

  useEffect(() => {
    onDirtyChange(isFormDirty)
  }, [isFormDirty, onDirtyChange])

  useEffect(() => {
    return () => onDirtyChange(false)
  }, [onDirtyChange])

  useEffect(() => {
    const trimmedQuery = userQuery.trim()
    if (formMode !== 'create' || selectedUser || trimmedQuery.length < 2) {
      setUserResults([])
      setIsSearchingUsers(false)
      setUserSearchError('')
      return
    }

    let isCancelled = false
    setIsSearchingUsers(true)
    setUserSearchError('')
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchUsers(trimmedQuery)
        if (!isCancelled) {
          setUserResults(results)
        }
      } catch (searchError) {
        if (!isCancelled) {
          setUserResults([])
          setUserSearchError(getErrorMessage(searchError, 'Kullanıcı araması yapılamadı.'))
        }
      } finally {
        if (!isCancelled) {
          setIsSearchingUsers(false)
        }
      }
    }, 300)

    return () => {
      isCancelled = true
      window.clearTimeout(timer)
    }
  }, [formMode, selectedUser, userQuery])

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const openCreateForm = async () => {
    if (!(await requestDiscard())) return

    const initialForm = createInitialForm()
    clearMessages()
    setFormMode('create')
    setEditingOccupancy(null)
    setClosingOccupancy(null)
    setForm(initialForm)
    setFormBaseline(initialForm)
    setSelectedUser(null)
    setUserQuery('')
    setUserResults([])
    setUserSearchError('')
  }

  const openEditForm = async (occupancy: UnitOccupancy) => {
    if (!(await requestDiscard())) return

    const editForm = {
      occupancyTypeId: occupancy.occupancyTypeId,
      startDate: toInputDate(occupancy.startDate),
      endDate: toInputDate(occupancy.endDate),
      isPrimary: occupancy.isPrimary,
      notes: occupancy.notes || '',
    }
    clearMessages()
    setFormMode('edit')
    setEditingOccupancy(occupancy)
    setClosingOccupancy(null)
    setForm(editForm)
    setFormBaseline(editForm)
  }

  const openCloseForm = async (occupancy: UnitOccupancy) => {
    if (!(await requestDiscard())) return

    const initialCloseDate = todayAsInputDate()
    clearMessages()
    setFormMode('close')
    setClosingOccupancy(occupancy)
    setEditingOccupancy(null)
    setCloseDate(initialCloseDate)
    setCloseDateBaseline(initialCloseDate)
  }

  const cancelForm = async () => {
    if (!(await requestDiscard())) return

    clearMessages()
    setFormMode('none')
    setEditingOccupancy(null)
    setClosingOccupancy(null)
    setSelectedUser(null)
    setUserQuery('')
    setUserResults([])
    setUserSearchError('')
  }

  const closeManagement = async () => {
    if (!(await requestDiscard())) return
    onClose()
  }

  const validateDateRange = (): boolean => {
    if (form.endDate && form.endDate < form.startDate) {
      setError('Bitiş tarihi başlangıç tarihinden önce olamaz.')
      return false
    }
    return true
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()

    if (!selectedUser) {
      setError('Lütfen atanacak kullanıcıyı arayıp seçin.')
      return
    }
    if (!validateDateRange()) return

    const payload: CreateUnitOccupancyPayload = {
      userId: selectedUser.id,
      occupancyTypeId: form.occupancyTypeId,
      startDate: toStartOfDayUtcIso(form.startDate),
      endDate: form.endDate ? toEndOfDayUtcIso(form.endDate) : null,
      isPrimary: form.isPrimary,
      notes: form.notes.trim() || null,
    }

    setIsSubmitting(true)
    try {
      await createUnitOccupancy(unit.id, payload)
      await loadOccupancies()
      setFormMode('none')
      setSelectedUser(null)
      setUserQuery('')
      setSuccess('Sakin ataması başarıyla oluşturuldu.')
    } catch (createError) {
      setError(getErrorMessage(createError, 'Sakin ataması oluşturulamadı.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()
    if (!editingOccupancy || !validateDateRange()) return

    const payload: UpdateUnitOccupancyPayload = {
      occupancyTypeId: form.occupancyTypeId,
      startDate: toStartOfDayUtcIso(form.startDate),
      endDate: form.endDate ? toEndOfDayUtcIso(form.endDate) : null,
      isPrimary: form.isPrimary,
      notes: form.notes.trim() || null,
    }

    setIsSubmitting(true)
    try {
      await updateUnitOccupancy(editingOccupancy.id, payload)
      await loadOccupancies()
      setFormMode('none')
      setEditingOccupancy(null)
      setSuccess('Sakin kaydı başarıyla güncellendi.')
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'Sakin kaydı güncellenemedi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()
    if (!closingOccupancy) return

    if (closeDate < toInputDate(closingOccupancy.startDate)) {
      setError('Bitiş tarihi başlangıç tarihinden önce olamaz.')
      return
    }

    const confirmed = window.confirm(
      `${closingOccupancy.userFullName} için bu ikamet ilişkisini ${formatDate(
        closeDate
      )} tarihinde sonlandırmak istediğinizden emin misiniz?`
    )
    if (!confirmed) return

    setIsSubmitting(true)
    try {
      await closeUnitOccupancy(closingOccupancy.id, { endDate: toEndOfDayUtcIso(closeDate) })
      await loadOccupancies()
      setFormMode('none')
      setClosingOccupancy(null)
      setSuccess('Sakin kaydı başarıyla sonlandırıldı.')
    } catch (closeError) {
      setError(getErrorMessage(closeError, 'Sakin kaydı sonlandırılamadı.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderOccupancyFields = (isEditing: boolean) => (
    <>
      {isEditing && editingOccupancy && (
        <div className="form-field form-field-full readonly-field">
          <span className="readonly-label">Kullanıcı ve Bağımsız Bölüm</span>
          <strong>{editingOccupancy.userFullName}</strong>
          <small>{editingOccupancy.userEmail} · {unit.unitNumber}</small>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="occupancy-type">İkamet Türü *</label>
        <select
          id="occupancy-type"
          value={form.occupancyTypeId}
          onChange={(event) => setForm({ ...form, occupancyTypeId: Number(event.target.value) })}
          required
        >
          {OCCUPANCY_TYPES.map((type) => (
            <option key={type.code} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="occupancy-start-date">Başlangıç Tarihi *</label>
        <input
          id="occupancy-start-date"
          type="date"
          value={form.startDate}
          onChange={(event) => setForm({ ...form, startDate: event.target.value })}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="occupancy-end-date">Bitiş Tarihi</label>
        <input
          id="occupancy-end-date"
          type="date"
          value={form.endDate}
          onChange={(event) => setForm({ ...form, endDate: event.target.value })}
          required={Boolean(isEditing && editingRecordIsPast)}
          max={isEditing && editingRecordIsPast ? todayAsInputDate() : undefined}
        />
      </div>

      <div className="form-field checkbox-field occupancy-primary-field">
        <label htmlFor="occupancy-primary">
          <input
            id="occupancy-primary"
            type="checkbox"
            checked={form.isPrimary}
            onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })}
          />
          <span>Bu dairenin birincil sakini</span>
        </label>
        <small className="field-help">Aynı anda yalnızca bir aktif sakin birincil olarak seçilebilir.</small>
      </div>

      <div className="form-field form-field-full">
        <label htmlFor="occupancy-notes">Notlar</label>
        <textarea
          id="occupancy-notes"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          maxLength={500}
          rows={3}
          placeholder="İsteğe bağlı not"
        />
      </div>
    </>
  )

  return (
    <section className="panel occupancy-panel">
      <div className="occupancy-panel-header">
        <div className="section-heading">
          <p className="eyebrow">Bölüm Detayı</p>
          <h2>{unit.unitTypeName} {unit.unitNumber} — Sakin Yönetimi</h2>
          <p>{unit.propertyName} · {unit.buildingName}</p>
        </div>
        <div className="occupancy-header-actions">
          <button className="primary-button compact-button" type="button" onClick={openCreateForm}>
            Yeni Sakin Ata
          </button>
          <button className="secondary-button" type="button" onClick={closeManagement}>
            Kapat
          </button>
        </div>
      </div>

      {error && <p className="status-message error-message" role="alert">{error}</p>}
      {success && <p className="status-message success-message" role="status">{success}</p>}

      {formMode === 'create' && (
        <form className="property-form occupancy-form" onSubmit={handleCreate}>
          <div className="form-field form-field-full user-search-field">
            <label htmlFor="occupancy-user-search">Kullanıcı Ara *</label>
            {selectedUser ? (
              <div className="selected-user-box">
                <div>
                  <strong>{selectedUser.fullName}</strong>
                  <span>{selectedUser.email}</span>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setSelectedUser(null)
                    setUserQuery('')
                    setUserResults([])
                    setUserSearchError('')
                  }}
                >
                  Değiştir
                </button>
              </div>
            ) : (
              <>
                <input
                  id="occupancy-user-search"
                  value={userQuery}
                  onChange={(event) => {
                    setUserQuery(event.target.value)
                    setUserSearchError('')
                  }}
                  placeholder="Ad, soyad veya e-posta (en az 2 karakter)"
                  autoComplete="off"
                />
                {userQuery.trim().length > 0 && userQuery.trim().length < 2 && (
                  <small className="field-help">Arama için en az 2 karakter girin.</small>
                )}
                {isSearchingUsers && <small className="field-help">Kullanıcılar aranıyor...</small>}
                {userSearchError && <small className="field-error">{userSearchError}</small>}
                {userQuery.trim().length >= 2 && !isSearchingUsers && !userSearchError && (
                  <div className="user-search-results">
                    {userResults.length === 0 ? (
                      <span className="no-user-result">Aktif kullanıcı bulunamadı.</span>
                    ) : (
                      userResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className="user-search-result"
                          onClick={() => {
                            setSelectedUser(result)
                            setUserQuery(result.fullName)
                            setUserResults([])
                          }}
                        >
                          <strong>{result.fullName}</strong>
                          <span>{result.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {renderOccupancyFields(false)}

          <div className="button-group form-field-full">
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Kaydediliyor...' : 'Atamayı Kaydet'}
            </button>
            <button className="secondary-button" type="button" onClick={cancelForm}>
              İptal
            </button>
          </div>
        </form>
      )}

      {formMode === 'edit' && editingOccupancy && (
        <form className="property-form occupancy-form" onSubmit={handleUpdate}>
          {editingRecordIsPast && (
            <p className="status-message empty-state-box form-field-full">
              Bu kayıt sonlandırılmıştır. Güncelleme kaydı yeniden aktif hale getirmez.
            </p>
          )}
          {renderOccupancyFields(true)}
          <div className="button-group form-field-full">
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Güncelleniyor...' : 'Kaydı Güncelle'}
            </button>
            <button className="secondary-button" type="button" onClick={cancelForm}>
              İptal
            </button>
          </div>
        </form>
      )}

      {formMode === 'close' && closingOccupancy && (
        <form className="property-form occupancy-form close-occupancy-form" onSubmit={handleClose}>
          <div className="form-field form-field-full readonly-field">
            <span className="readonly-label">Sonlandırılacak Kayıt</span>
            <strong>{closingOccupancy.userFullName}</strong>
            <small>{getOccupancyTypeLabel(closingOccupancy.occupancyTypeCode)} · Başlangıç: {formatDate(closingOccupancy.startDate)}</small>
          </div>
          <div className="form-field">
            <label htmlFor="occupancy-close-date">Bitiş Tarihi *</label>
            <input
              id="occupancy-close-date"
              type="date"
              value={closeDate}
              onChange={(event) => setCloseDate(event.target.value)}
              required
            />
          </div>
          <div className="button-group form-field-full">
            <button className="action-button danger-btn close-submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sonlandırılıyor...' : 'Sonlandırmayı Onayla'}
            </button>
            <button className="secondary-button" type="button" onClick={cancelForm}>
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="occupancy-list-heading">
        <h3>Sakin Kayıtları</h3>
        {!loadError && <span>{occupancies.length} kayıt</span>}
      </div>

      {isLoading && <p className="status-message">Sakin kayıtları yükleniyor...</p>}
      {!isLoading && loadError && (
        <div className="status-message error-message" role="alert">
          <p>{loadError}</p>
          <button className="secondary-button compact-button" type="button" onClick={() => void loadOccupancies()}>
            Tekrar Dene
          </button>
        </div>
      )}
      {!isLoading && !loadError && occupancies.length === 0 && (
        <p className="status-message empty-state-box">Bu bağımsız bölüm için henüz sakin kaydı bulunmuyor.</p>
      )}

      {!loadError && <div className="occupancy-card-list">
        {occupancies.map((occupancy) => {
          const status = getOccupancyStatus(occupancy)
          const isCurrent = status === 'Aktif'
          return (
            <article
              key={occupancy.id}
              className={`occupancy-card ${isCurrent ? 'current-occupancy' : 'past-occupancy'}`}
            >
              <div className="card-header">
                <div>
                  <h3>{occupancy.userFullName}</h3>
                  <p className="subtitle">@{occupancy.userName} · {occupancy.userEmail}</p>
                </div>
                <div className="occupancy-badges">
                  {occupancy.isPrimary && (
                    <span className="status-badge primary-badge">
                      {isCurrent ? 'Birincil Sakin' : 'Döneminde Birincil'}
                    </span>
                  )}
                  <span className={`status-badge ${isCurrent ? 'active' : 'inactive'}`}>
                    {status}
                  </span>
                </div>
              </div>

              <dl className="occupancy-details">
                <div>
                  <dt>İkamet Türü</dt>
                  <dd>{getOccupancyTypeLabel(occupancy.occupancyTypeCode)}</dd>
                </div>
                <div>
                  <dt>Başlangıç</dt>
                  <dd>{formatDate(occupancy.startDate)}</dd>
                </div>
                <div>
                  <dt>Bitiş</dt>
                  <dd>{formatDate(occupancy.endDate)}</dd>
                </div>
              </dl>

              <div className="occupancy-notes">
                <strong>Notlar</strong>
                <p>{occupancy.notes || 'Not eklenmemiş.'}</p>
              </div>

              <div className="card-actions">
                <button className="action-button edit-btn" type="button" onClick={() => openEditForm(occupancy)}>
                  Düzenle
                </button>
                {isCurrent && (
                  <button className="action-button danger-btn" type="button" onClick={() => openCloseForm(occupancy)}>
                    Sonlandır
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>}
      {unsavedChangesDialog}
    </section>
  )
}
