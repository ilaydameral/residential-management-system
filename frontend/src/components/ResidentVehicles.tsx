import { useState, useEffect, useCallback } from 'react'
import {
  getResidentVehicles,
  createResidentVehicle,
  updateResidentVehicle,
  setResidentVehicleStatus,
  getMyUnits,
} from '../api'
import type { ResidentVehicle, CreateResidentVehiclePayload, UpdateResidentVehiclePayload, ResidentUnit, VehicleType } from '../types'
import { RowActionsMenu } from './RowActionsMenu'
import { ConfirmationDialog } from './ConfirmationDialog'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { SaveShortcutHint } from './SaveShortcutHint'

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR: 'Otomobil',
  MOTORCYCLE: 'Motosiklet',
  ELECTRIC_VEHICLE: 'Elektrikli Araç',
  SUV: 'SUV',
  OTHER: 'Diğer',
}

export function ResidentVehicles() {
  const [vehicles, setVehicles] = useState<ResidentVehicle[]>([])
  const [residentUnits, setResidentUnits] = useState<ResidentUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<ResidentVehicle | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Deactivation confirmation
  const [deactivatingVehicle, setDeactivatingVehicle] = useState<ResidentVehicle | null>(null)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  // Form State
  const [formData, setFormData] = useState<CreateResidentVehiclePayload>({
    unitId: 0,
    plateNumber: '',
    vehicleType: 'CAR',
    brandModel: '',
    color: '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const isFormDirty = isDrawerOpen && (
    formData.plateNumber.trim() !== '' ||
    formData.brandModel?.trim() !== '' ||
    formData.color?.trim() !== ''
  )
  const { requestDiscard, unsavedChangesDialog } = useUnsavedChangesGuard(isFormDirty)

  const drawerAnimation = useAnimatedDrawer(isDrawerOpen)

  const handleCloseDrawer = async () => {
    if (!(await requestDiscard())) return
    setIsDrawerOpen(false)
    setEditingVehicle(null)
  }

  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.phase !== 'closed',
    onClose: () => { void handleCloseDrawer() },
    isSaving,
  })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [vList, uList] = await Promise.all([
        getResidentVehicles(),
        getMyUnits(),
      ])
      setVehicles(vList)
      setResidentUnits(uList)

      if (uList.length === 1 && formData.unitId === 0) {
        setFormData(prev => ({ ...prev, unitId: uList[0].unitId }))
      }
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Araçlar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [formData.unitId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const handleOpenNewDrawer = () => {
    const defaultUnitId = residentUnits.length > 0 ? residentUnits[0].unitId : 0
    setEditingVehicle(null)
    setFormData({
      unitId: defaultUnitId,
      plateNumber: '',
      vehicleType: 'CAR',
      brandModel: '',
      color: '',
    })
    setFormError(null)
    setIsDrawerOpen(true)
  }

  const handleOpenEditDrawer = (v: ResidentVehicle) => {
    setEditingVehicle(v)
    setFormData({
      unitId: v.unitId,
      plateNumber: v.plateNumber,
      vehicleType: v.vehicleType,
      brandModel: v.brandModel || '',
      color: v.color || '',
    })
    setFormError(null)
    setIsDrawerOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!editingVehicle && !formData.unitId) {
      setFormError('Lütfen bir daire seçin.')
      return
    }

    if (!formData.plateNumber.trim()) {
      setFormError('Lütfen araç plakasını girin.')
      return
    }

    try {
      setIsSaving(true)
      if (editingVehicle) {
        const updatePayload: UpdateResidentVehiclePayload = {
          vehicleType: formData.vehicleType,
          brandModel: formData.brandModel,
          color: formData.color,
        }
        await updateResidentVehicle(editingVehicle.id, updatePayload)
        setToastMessage('Araç bilgileri güncellendi.')
      } else {
        await createResidentVehicle(formData)
        setToastMessage('Araç kaydı başarıyla oluşturuldu.')
      }

      setIsDrawerOpen(false)
      setEditingVehicle(null)
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Araç işlemi başarısız.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (v: ResidentVehicle) => {
    if (v.isActive) {
      setDeactivatingVehicle(v)
      return
    }

    // Activating directly
    try {
      setIsTogglingStatus(true)
      await setResidentVehicleStatus(v.id, true)
      setToastMessage(`${v.plateNumber} plakalı araç aktifleştirildi.`)
      await loadData()
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Durum değiştirilemedi.')
    } finally {
      setIsTogglingStatus(false)
    }
  }

  const handleConfirmDeactivate = async () => {
    if (!deactivatingVehicle) return
    try {
      setIsTogglingStatus(true)
      await setResidentVehicleStatus(deactivatingVehicle.id, false)
      setToastMessage(`${deactivatingVehicle.plateNumber} plakalı araç pasife alındı.`)
      setDeactivatingVehicle(null)
      await loadData()
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Araç pasife alınamadı.')
    } finally {
      setIsTogglingStatus(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-lg bg-surface border border-border shadow-lg text-sm text-primary animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-main">Araçlarım</h1>
          <p className="text-sm text-muted mt-1">
            Dairelerinize tanımlı araç bilgilerinizi yönetin.
          </p>
        </div>
        <button
          type="button"
          className="primary-button inline-flex items-center gap-2 self-start sm:self-auto"
          onClick={handleOpenNewDrawer}
        >
          <span>Yeni Araç</span>
        </button>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="p-8 text-center text-muted">Araçlar yükleniyor...</div>
      ) : vehicles.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-surface space-y-3">
          <p className="text-muted">Henüz kayıtlı bir aracınız bulunmuyor.</p>
          <button
            type="button"
            className="primary-button"
            onClick={handleOpenNewDrawer}
          >
            Araç Ekle
          </button>
        </div>
      ) : (
        <div className="table-responsive rounded-xl border border-border bg-surface shadow-sm">
          <table className="management-table">
            <thead>
              <tr>
                <th>Plaka</th>
                <th>Araç Tipi</th>
                <th>Marka / Model</th>
                <th>Renk</th>
                <th>Daire</th>
                <th>Durum</th>
                <th className="text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td>
                    <span className="font-mono font-bold text-main px-2 py-1 bg-surface-secondary rounded border border-border">
                      {v.plateNumber}
                    </span>
                  </td>
                  <td>{VEHICLE_TYPE_LABELS[v.vehicleType] || v.vehicleType}</td>
                  <td>{v.brandModel || '-'}</td>
                  <td>{v.color || '-'}</td>
                  <td>{v.buildingName} No: {v.unitNumber}</td>
                  <td>
                    <span className={`status-badge ${v.isActive ? 'status-badge-approved' : 'status-badge-neutral'}`}>
                      {v.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="text-right">
                    <RowActionsMenu
                      label="Araç İşlemleri"
                      primaryAction={{
                        label: 'Düzenle',
                        onSelect: () => handleOpenEditDrawer(v),
                      }}
                      secondaryActions={[
                        v.isActive
                          ? {
                              label: 'Pasife Al',
                              danger: true,
                              onSelect: () => handleToggleStatus(v),
                            }
                          : {
                              label: 'Aktifleştir',
                              onSelect: () => handleToggleStatus(v),
                            },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deactivate Confirmation Dialog */}
      {deactivatingVehicle && (
        <ConfirmationDialog
          title="Aracı Pasife Al"
          message={`${deactivatingVehicle.plateNumber} plakalı aracı pasife almak istediğinize emin misiniz?`}
          confirmLabel="Pasife Al"
          danger
          isLoading={isTogglingStatus}
          onConfirm={handleConfirmDeactivate}
          onCancel={() => setDeactivatingVehicle(null)}
        />
      )}

      {/* Drawer Form */}
      {drawerAnimation.phase !== 'closed' && (
        <>
          <div
            className={`drawer-backdrop ${drawerAnimation.phase === 'open' ? 'backdrop-open' : 'backdrop-closing'}`}
            onClick={handleCloseDrawer}
          />
          <div
            ref={drawerRef as any}
            tabIndex={-1}
            className={`management-drawer drawer-${drawerAnimation.phase}`}
          >
            <div className="drawer-header">
              <h2>{editingVehicle ? 'Araç Bilgilerini Düzenle' : 'Yeni Araç'}</h2>
              <button type="button" className="close-button" onClick={handleCloseDrawer}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="drawer-form flex-1 flex flex-col justify-between">
              <div className="drawer-body space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-danger-soft text-danger text-sm border border-danger-border">
                    {formError}
                  </div>
                )}

                {!editingVehicle && (
                  <div className="form-field">
                    <label htmlFor="veh-unit">Bağlı Daire *</label>
                    <select
                      id="veh-unit"
                      required
                      value={formData.unitId}
                      onChange={e => setFormData({ ...formData, unitId: Number(e.target.value) })}
                    >
                      {residentUnits.map(u => (
                        <option key={u.unitId} value={u.unitId}>
                          {u.buildingName} - No: {u.unitNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="veh-plate">Plaka *</label>
                  <input
                    id="veh-plate"
                    type="text"
                    required
                    disabled={Boolean(editingVehicle)}
                    placeholder="Örn: 34 ABC 123"
                    value={formData.plateNumber}
                    onChange={e => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                  />
                  {editingVehicle && (
                    <small className="field-help">Plaka bilgisi değiştirilemez.</small>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="veh-type">Araç Tipi *</label>
                  <select
                    id="veh-type"
                    required
                    value={formData.vehicleType}
                    onChange={e => setFormData({ ...formData, vehicleType: e.target.value as VehicleType })}
                  >
                    <option value="CAR">Otomobil</option>
                    <option value="MOTORCYCLE">Motosiklet</option>
                    <option value="ELECTRIC_VEHICLE">Elektrikli Araç</option>
                    <option value="SUV">SUV</option>
                    <option value="OTHER">Diğer</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="veh-brand">Marka / Model (İsteğe Bağlı)</label>
                  <input
                    id="veh-brand"
                    type="text"
                    placeholder="Örn: Volkswagen Golf"
                    value={formData.brandModel || ''}
                    onChange={e => setFormData({ ...formData, brandModel: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="veh-color">Renk (İsteğe Bağlı)</label>
                  <input
                    id="veh-color"
                    type="text"
                    placeholder="Örn: Beyaz"
                    value={formData.color || ''}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
              </div>

              <div className="drawer-actions form-field-full">
                <SaveShortcutHint />
                <button type="button" className="secondary-button" onClick={handleCloseDrawer}>
                  İptal
                </button>
                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? 'Kaydediliyor...' : editingVehicle ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {unsavedChangesDialog}
    </div>
  )
}
