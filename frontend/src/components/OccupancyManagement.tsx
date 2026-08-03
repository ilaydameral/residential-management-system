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

interface OccupancyManagementProps {
  unit: Unit
  onClose: () => void
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
  return new Date().toISOString().slice(0, 10)
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

function toUtcIso(date: string): string {
  return `${date}T00:00:00.000Z`
}

function toInputDate(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

function formatDate(value: string | null): string {
  if (!value) return '—'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function isCurrentOccupancy(occupancy: UnitOccupancy): boolean {
  if (!occupancy.isActive) return false
  if (!occupancy.endDate) return true
  return new Date(occupancy.endDate).getTime() >= Date.now()
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function OccupancyManagement({ unit, onClose }: OccupancyManagementProps) {
  const [occupancies, setOccupancies] = useState<UnitOccupancy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit' | 'close'>('none')
  const [form, setForm] = useState<OccupancyFormState>(createInitialForm)
  const [editingOccupancy, setEditingOccupancy] = useState<UnitOccupancy | null>(null)
  const [closingOccupancy, setClosingOccupancy] = useState<UnitOccupancy | null>(null)
  const [closeDate, setCloseDate] = useState(todayAsInputDate())

  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [userSearchError, setUserSearchError] = useState('')

  const editingRecordIsPast = Boolean(
    editingOccupancy && !isCurrentOccupancy(editingOccupancy)
  )

  const loadOccupancies = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getUnitOccupancies(unit.id, true)
      setOccupancies(data)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Sakin kayıtları yüklenemedi.'))
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
    setSuccess('')
    void loadOccupancies()
  }, [loadOccupancies])

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

  const openCreateForm = () => {
    clearMessages()
    setFormMode('create')
    setEditingOccupancy(null)
    setClosingOccupancy(null)
    setForm(createInitialForm())
    setSelectedUser(null)
    setUserQuery('')
    setUserResults([])
    setUserSearchError('')
  }

  const openEditForm = (occupancy: UnitOccupancy) => {
    clearMessages()
    setFormMode('edit')
    setEditingOccupancy(occupancy)
    setClosingOccupancy(null)
    setForm({
      occupancyTypeId: occupancy.occupancyTypeId,
      startDate: toInputDate(occupancy.startDate),
      endDate: toInputDate(occupancy.endDate),
      isPrimary: occupancy.isPrimary,
      notes: occupancy.notes || '',
    })
  }

  const openCloseForm = (occupancy: UnitOccupancy) => {
    clearMessages()
    setFormMode('close')
    setClosingOccupancy(occupancy)
    setEditingOccupancy(null)
    setCloseDate(todayAsInputDate())
  }

  const cancelForm = () => {
    clearMessages()
    setFormMode('none')
    setEditingOccupancy(null)
    setClosingOccupancy(null)
    setSelectedUser(null)
    setUserQuery('')
    setUserResults([])
    setUserSearchError('')
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
      startDate: toUtcIso(form.startDate),
      endDate: form.endDate ? toUtcIso(form.endDate) : null,
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
      startDate: toUtcIso(form.startDate),
      endDate: form.endDate ? toUtcIso(form.endDate) : null,
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
        toUtcIso(closeDate)
      )} tarihinde sonlandırmak istediğinizden emin misiniz?`
    )
    if (!confirmed) return

    setIsSubmitting(true)
    try {
      await closeUnitOccupancy(closingOccupancy.id, { endDate: toUtcIso(closeDate) })
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
          <button className="secondary-button" type="button" onClick={onClose}>
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
        <span>{occupancies.length} kayıt</span>
      </div>

      {isLoading && <p className="status-message">Sakin kayıtları yükleniyor...</p>}
      {!isLoading && occupancies.length === 0 && (
        <p className="status-message empty-state-box">Bu bağımsız bölüm için henüz sakin kaydı bulunmuyor.</p>
      )}

      <div className="occupancy-card-list">
        {occupancies.map((occupancy) => {
          const isCurrent = isCurrentOccupancy(occupancy)
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
                  {occupancy.isPrimary && <span className="status-badge primary-badge">Birincil Sakin</span>}
                  <span className={`status-badge ${isCurrent ? 'active' : 'inactive'}`}>
                    {isCurrent ? 'Aktif' : 'Geçmiş / Pasif'}
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
                <div>
                  <dt>Kayıt Durumu</dt>
                  <dd>{occupancy.isActive ? 'Aktif işaretli' : 'Pasif'}</dd>
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
      </div>
    </section>
  )
}
