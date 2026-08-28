import { useState, useEffect, useCallback } from 'react'
import {
  getResidentVehicles,
  createResidentVehicle,
  updateResidentVehicle,
  setResidentVehicleStatus,
} from '../api'
import type { ResidentVehicle, CreateResidentVehiclePayload, UpdateResidentVehiclePayload, VehicleType } from '../types'
import { RowActionsMenu } from './RowActionsMenu'
import { ConfirmationDialog } from './ConfirmationDialog'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { useResidentUnits } from '../hooks/useResidentUnits'
import { SaveShortcutHint } from './SaveShortcutHint'
import { LoadingSkeleton } from './LoadingSkeleton'
import { useToast } from '../context/ToastContext'
import { PageHeader } from './PageHeader'

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR: 'Otomobil',
  MOTORCYCLE: 'Motosiklet',
  ELECTRIC_VEHICLE: 'Elektrikli Araç',
  SUV: 'SUV',
  OTHER: 'Diğer',
}

export function ResidentVehicles() {
  const { groupedUnits, loading: unitsLoading, refetch: refetchUnits } = useResidentUnits()
  const { showToast } = useToast()
  const [vehicles, setVehicles] = useState<ResidentVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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
    if (isSaving) return
    if (!(await requestDiscard())) return
    drawerAnimation.close(() => {
      setIsDrawerOpen(false)
      setEditingVehicle(null)
    })
  }

  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.phase !== 'closed',
    onClose: () => { void handleCloseDrawer() },
    isSaving,
  })

  // Sync unitId when groupedUnits finishes loading
  useEffect(() => {
    if (groupedUnits.length > 0 && (!formData.unitId || !groupedUnits.some(u => u.unitId === formData.unitId))) {
      setFormData(prev => ({ ...prev, unitId: groupedUnits[0].unitId }))
    }
  }, [groupedUnits, formData.unitId])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const vList = await getResidentVehicles()
      setVehicles(vList)
      await refetchUnits()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Araçlar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [refetchUnits])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenNewDrawer = () => {
    if (groupedUnits.length === 0) {
      showToast('Aktif daire yerleşiminiz bulunmadığı için araç kaydı oluşturamazsınız.', 'info')
      return
    }

    const defaultUnitId = groupedUnits.length > 0 ? groupedUnits[0].unitId : 0
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
    if (isSaving) return

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
        showToast('Araç bilgileri güncellendi.')
      } else {
        await createResidentVehicle(formData)
        showToast('Araç kaydı başarıyla oluşturuldu.')
      }

      drawerAnimation.close(() => {
        setIsDrawerOpen(false)
        setEditingVehicle(null)
      })
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

    try {
      setIsTogglingStatus(true)
      await setResidentVehicleStatus(v.id, true)
      showToast(`${v.plateNumber} plakalı araç aktifleştirildi.`)
      await loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Durum değiştirilemedi.', 'error')
    } finally {
      setIsTogglingStatus(false)
    }
  }

  const handleConfirmDeactivate = async () => {
    if (!deactivatingVehicle) return
    try {
      setIsTogglingStatus(true)
      await setResidentVehicleStatus(deactivatingVehicle.id, false)
      showToast(`${deactivatingVehicle.plateNumber} plakalı araç pasife alındı.`)
      setDeactivatingVehicle(null)
      await loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Araç pasife alınamadı.', 'error')
    } finally {
      setIsTogglingStatus(false)
    }
  }

  return (
    <section className="resident-view-content resident-vehicles-view" aria-label="Araçlarım">
      <PageHeader
        className="resident-page-header"
        eyebrow="Sakin Portalı"
        title="Araçlarım"
        subtitle="Dairelerinize tanımlı araç bilgilerinizi görüntüleyin ve yeni araç kaydı ekleyin."
        action={(
          <button type="button" className="primary-button" onClick={handleOpenNewDrawer}>
            Yeni Araç
          </button>
        )}
      />

      {/* Content Surface Card */}
      <div className="management-card" style={{ padding: '20px' }}>
        {loading || unitsLoading ? (
          <LoadingSkeleton variant="table" rows={4} />
        ) : loadError ? (
          <section className="panel entity-state-panel error-state" role="alert">
            <p className="status-message error-message">{loadError}</p>
            <button type="button" className="secondary-button" onClick={() => void loadData()}>Tekrar Dene</button>
          </section>
        ) : vehicles.length === 0 ? (
          <div className="panel entity-state-panel" style={{ padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '8px' }}>
              🚗
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Kayıtlı aracınız bulunmuyor.</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '400px' }}>
              Sitenize ait araçlarınızı yukarıdaki "Yeni Araç" butonu ile sisteme ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="responsive-table-wrapper resident-vehicles-table-wrapper">
            <table className="management-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Plaka</th>
                  <th>Araç Tipi</th>
                  <th>Marka / Model</th>
                  <th>Renk</th>
                  <th>Daire</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => (
                  <tr key={v.id}>
                    <td>
                      <code className="resident-visitor-plate-code">
                        {v.plateNumber}
                      </code>
                    </td>
                    <td style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {VEHICLE_TYPE_LABELS[v.vehicleType] || v.vehicleType}
                    </td>
                    <td style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                      {v.brandModel || '-'}
                    </td>
                    <td style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                      {v.color || '-'}
                    </td>
                    <td style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      Daire {v.unitNumber} · {v.buildingName}
                    </td>
                    <td>
                      <span className={`status-badge ${v.isActive ? 'active' : 'inactive'}`}>
                        {v.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowActionsMenu
                        primaryAction={{
                          label: 'Düzenle',
                          onSelect: () => handleOpenEditDrawer(v),
                        }}
                        secondaryActions={[
                          {
                            label: v.isActive ? 'Pasife Al' : 'Aktifleştir',
                            danger: v.isActive,
                            onSelect: () => void handleToggleStatus(v),
                          },
                        ]}
                        label={`${v.plateNumber} İşlemleri`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deactivation Dialog */}
      {deactivatingVehicle && (
        <ConfirmationDialog
          title="Araç Deaktivasyonu"
          message={`${deactivatingVehicle.plateNumber} plakalı aracı pasife almak istediğinize emin misiniz?`}
          confirmLabel="Pasife Al"
          danger
          isLoading={isTogglingStatus}
          onConfirm={handleConfirmDeactivate}
          onCancel={() => setDeactivatingVehicle(null)}
        />
      )}

      {/* New / Edit Drawer */}
      {drawerAnimation.phase !== 'closed' && (
        <>
          <button
            type="button"
            className={`drawer-backdrop drawer-${drawerAnimation.phase}`}
            aria-label="Araç formunu kapat"
            disabled={drawerAnimation.isClosing || isSaving}
            onClick={handleCloseDrawer}
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className={`management-drawer drawer-${drawerAnimation.phase}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-drawer-title"
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Araç Yönetimi</p>
                <h2 id="vehicle-drawer-title" tabIndex={-1} data-drawer-initial-focus>{editingVehicle ? 'Araç Bilgilerini Düzenle' : 'Yeni Araç'}</h2>
                <p className="drawer-description">Dairenize bağlı araç bilgilerini düzenleyin.</p>
              </div>
              <button type="button" className="drawer-close-button" aria-label="Kapat" onClick={handleCloseDrawer} disabled={isSaving}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="drawer-form" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                {formError && (
                  <div className="status-message error-message" role="alert">
                    {formError}
                  </div>
                )}

                {!editingVehicle && (
                  <div className="form-field">
                    <label htmlFor="veh-unit">Bağlı Daire *</label>
                    {groupedUnits.length === 0 ? (
                      <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-warning-soft, #fef7e0)', color: 'var(--color-warning, #b06000)', fontSize: '12px', border: '1px solid var(--color-warning-border, #ffe0b2)' }}>
                        Aktif bir daire yerleşiminiz bulunmamaktadır.
                      </div>
                    ) : groupedUnits.length === 1 ? (
                      <div style={{ padding: '10px 12px', background: 'var(--color-surface-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 500 }}>
                        Daire {groupedUnits[0].unitNumber} · {groupedUnits[0].buildingName} · {groupedUnits[0].propertyName}
                      </div>
                    ) : (
                      <select
                        id="veh-unit"
                        required
                        value={formData.unitId}
                        onChange={e => setFormData({ ...formData, unitId: Number(e.target.value) })}
                      >
                        {groupedUnits.map(u => (
                          <option key={u.unitId} value={u.unitId}>
                            Daire {u.unitNumber} · {u.buildingName} · {u.propertyName}
                          </option>
                        ))}
                      </select>
                    )}
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
                    <small className="field-help" style={{ marginTop: '4px', display: 'block', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                      Plaka bilgisi değiştirilemez.
                    </small>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div className="form-field">
                    <label htmlFor="veh-brand">Marka / Model</label>
                    <input
                      id="veh-brand"
                      type="text"
                      placeholder="Örn: Toyota Corolla"
                      value={formData.brandModel || ''}
                      onChange={e => setFormData({ ...formData, brandModel: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="veh-color">Renk</label>
                    <input
                      id="veh-color"
                      type="text"
                      placeholder="Örn: Beyaz"
                      value={formData.color || ''}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="drawer-actions form-field-full" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', position: 'sticky', bottom: 0, background: 'var(--color-surface)' }}>
                <SaveShortcutHint />
                <button type="button" className="secondary-button" onClick={handleCloseDrawer} disabled={isSaving}>
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSaving || (!editingVehicle && groupedUnits.length === 0)}
                >
                  {isSaving ? 'Kaydediliyor...' : editingVehicle ? 'Güncelle' : 'Araç Ekle'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {unsavedChangesDialog}
    </section>
  )
}
