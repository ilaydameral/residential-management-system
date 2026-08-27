import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelFacilityReservation,
  createFacilityReservation,
  getFacilities,
  getFacilityAvailability,
  getMyFacilityReservations,
  getMyUnits,
} from '../api'
import { useAnimatedDrawer } from '../hooks/useAnimatedDrawer'
import { useDrawerAccessibility } from '../hooks/useDrawerAccessibility'
import { useToast } from '../context/ToastContext'
import { useRealtime } from '../realtime/useRealtime'
import type {
  CommonFacility,
  FacilityAvailability,
  FacilityReservation,
  ResidentUnit,
  TimeSlot,
} from '../types'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoadingSkeleton } from './LoadingSkeleton'

const STATUS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Onay Bekliyor', className: 'status-badge warning' },
  APPROVED: { label: 'Onaylandı', className: 'status-badge success' },
  REJECTED: { label: 'Reddedildi', className: 'status-badge danger' },
  CANCELLED: { label: 'İptal Edildi', className: 'status-badge secondary' },
  COMPLETED: { label: 'Tamamlandı', className: 'status-badge info' },
}

function CalendarIcon({ width = 18, height = 18 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function ClockIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function UsersIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function LocationIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function formatTimeRange(startStr: string, endStr: string): string {
  try {
    const s = new Date(startStr)
    const e = new Date(endStr)
    const datePart = s.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    const startTime = s.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const endTime = e.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    return `${datePart} • ${startTime} - ${endTime}`
  } catch {
    return `${startStr} - ${endStr}`
  }
}

export function ResidentFacilities() {
  const realtime = useRealtime()
  const { showToast } = useToast()

  // State
  const [facilities, setFacilities] = useState<CommonFacility[]>([])
  const [myReservations, setMyReservations] = useState<FacilityReservation[]>([])
  const [myUnits, setMyUnits] = useState<ResidentUnit[]>([])
  const [activeTab, setActiveTab] = useState<'facilities' | 'reservations'>('facilities')
  const [reservationSubTab, setReservationSubTab] = useState<'upcoming' | 'past'>('upcoming')

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Booking / Detail Drawer
  const [selectedFacility, setSelectedFacility] = useState<CommonFacility | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [availability, setAvailability] = useState<FacilityAvailability | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null)
  const [bookingNote, setBookingNote] = useState('')
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  // Cancellation Modal
  const [cancellingReservation, setCancellingReservation] = useState<FacilityReservation | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const drawerAnimation = useAnimatedDrawer(isDrawerOpen)
  const closeDrawer = () => {
    if (isSubmittingBooking) return
    setIsDrawerOpen(false)
  }
  const drawerRef = useDrawerAccessibility({
    isOpen: drawerAnimation.shouldRender && !drawerAnimation.isClosing,
    onClose: closeDrawer,
    enableSaveShortcut: false,
    isSaving: isSubmittingBooking,
  })

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [facList, resList, unitList] = await Promise.all([
        getFacilities({ isActive: true }),
        getMyFacilityReservations(),
        getMyUnits(),
      ])
      setFacilities(facList)
      setMyReservations(resList)
      setMyUnits(unitList)
      if (unitList.length > 0) {
        setSelectedUnitId(unitList[0].unitId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tesis bilgileri yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Realtime SignalR Listeners
  useEffect(() => {
    if (!realtime) return

    const unsubAvail = realtime.onFacilityAvailabilityInvalidated((evt) => {
      if (selectedFacility && evt.facilityId === selectedFacility.id && evt.date === selectedDate) {
        void fetchAvailability(selectedFacility.id, selectedDate)
      }
    })

    const unsubRes = realtime.onFacilityReservationUpdated(() => {
      void getMyFacilityReservations().then(setMyReservations)
    })

    return () => {
      unsubAvail()
      unsubRes()
    }
  }, [realtime, selectedFacility, selectedDate])

  // Fetch Availability for facility & date
  const fetchAvailability = async (facilityId: number, dateStr: string) => {
    setIsLoadingAvailability(true)
    setBookingError(null)
    try {
      const avail = await getFacilityAvailability(facilityId, dateStr)
      setAvailability(avail)
      setSelectedSlot(null)
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Kullanılabilirlik bilgisi alınamadı.')
      setAvailability(null)
    } finally {
      setIsLoadingAvailability(false)
    }
  };

  const handleOpenFacilityDetail = (facility: CommonFacility) => {
    setSelectedFacility(facility)
    setSelectedSlot(null)
    setBookingNote('')
    setBookingError(null)
    setIsDrawerOpen(true)
    const today = new Date().toISOString().split('T')[0]
    setSelectedDate(today)
    void fetchAvailability(facility.id, today)
  }

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    if (selectedFacility) {
      void fetchAvailability(selectedFacility.id, newDate)
    }
  }

  const handleCreateBooking = async () => {
    if (!selectedFacility || !selectedSlot || !selectedUnitId) return

    setIsSubmittingBooking(true)
    setBookingError(null)

    try {
      const payload = {
        facilityId: selectedFacility.id,
        unitId: selectedUnitId,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        note: bookingNote.trim() || undefined,
      }

      const res = await createFacilityReservation(payload)

      if (res.status === 'APPROVED') {
        showToast('Rezervasyonunuz başarıyla oluşturuldu ve onaylandı.')
      } else {
        showToast('Rezervasyon talebiniz yönetici onayına gönderildi.')
      }

      setSelectedSlot(null)
      setBookingNote('')

      // Refresh state
      await Promise.all([
        fetchAvailability(selectedFacility.id, selectedDate),
        getMyFacilityReservations().then(setMyReservations),
      ])
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Rezervasyon oluşturulamadı.'
      if (err.status === 409 || msg.includes('çakışmaktadır') || msg.includes('dolu')) {
        setBookingError('Bu zaman dilimi az önce başka bir kullanıcı tarafından rezerve edildi. Lütfen başka bir saat seçiniz.')
        if (selectedFacility) {
          void fetchAvailability(selectedFacility.id, selectedDate)
        }
      } else {
        setBookingError(msg)
      }
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  const handleCancelReservation = async () => {
    if (!cancellingReservation) return

    setIsCancelling(true)
    try {
      await cancelFacilityReservation(cancellingReservation.id)
      showToast('Rezervasyon başarıyla iptal edildi.')
      setMyReservations(await getMyFacilityReservations())
      if (selectedFacility) {
        void fetchAvailability(selectedFacility.id, selectedDate)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rezervasyon iptal edilemedi.', 'error')
    } finally {
      setIsCancelling(false)
      setCancellingReservation(null)
    }
  }

  // Filter My Reservations
  const now = new Date()
    const upcomingReservations = useMemo(
    () => myReservations.filter((r) => new Date(r.endTime) >= now),
    [myReservations, now]
  )
  const pastReservations = useMemo(
    () => myReservations.filter((r) => new Date(r.endTime) < now),
    [myReservations, now]
  )

  return (
    <section className="resident-view-content" aria-label="Ortak Alanlar">
      {/* Page Header */}
      <header className="resident-view-header">
        <p className="eyebrow">SAKİN PORTALI</p>
        <h1>Ortak Alanlar</h1>
        <p>Sitenizdeki sosyal tesisleri, spor alanlarını ve toplantı salonlarını inceleyin ve randevu alın.</p>
      </header>

      {/* Segmented Control Bar */}
      <div className="resident-segmented-control" role="tablist" aria-label="Ortak alan sekmeleri">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'facilities'}
          className={`resident-segmented-btn ${activeTab === 'facilities' ? 'active' : ''}`}
          onClick={() => setActiveTab('facilities')}
        >
          <span>Tesisler</span>
          <span className="tab-badge">{facilities.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reservations'}
          className={`resident-segmented-btn ${activeTab === 'reservations' ? 'active' : ''}`}
          onClick={() => setActiveTab('reservations')}
        >
          <span>Rezervasyonlarım</span>
          <span className="tab-badge">{upcomingReservations.length}</span>
        </button>
      </div>

      {/* Main Content Surface */}
      <div className="panel resident-facilities-panel">
        {isLoading ? (
          <LoadingSkeleton variant="dashboard" />
        ) : error ? (
          <section className="entity-state-panel error-state" role="alert">
            <p className="status-message error-message">{error}</p>
            <button type="button" className="secondary-button" onClick={() => void loadData()}>Tekrar Dene</button>
          </section>
        ) : activeTab === 'facilities' ? (
          /* FACILITIES BROWSER */
          facilities.length === 0 ? (
            <div className="resident-empty-state-box">
              <div className="empty-icon-circle">
                <CalendarIcon width={28} height={28} />
              </div>
              <h3>Aktif Tesis Bulunamadı</h3>
              <p className="empty-description">
                Sitenizde şu anda rezervasyona açık bir ortak alan bulunmuyor.
              </p>
              <span className="empty-subtext">
                Yeni tesisler kullanıma açıldığında burada görüntülenecek.
              </span>
            </div>
          ) : (
            <div className="facilities-cards-grid">
              {facilities.map((facility) => (
                <article key={facility.id} className="facility-card">
                  <div className="facility-card-header">
                    <div>
                      <span className="badge-context">
                        {facility.buildingName ? `${facility.propertyName} / ${facility.buildingName}` : facility.propertyName}
                      </span>
                      <h3 className="facility-card-title">{facility.name}</h3>
                    </div>
                    {facility.requiresManagerApproval && (
                      <span className="status-badge warning" title="Yönetici onayı gerektirir">
                        Onaylı
                      </span>
                    )}
                  </div>

                  {facility.description && <p className="facility-card-desc">{facility.description}</p>}

                  <div className="facility-card-meta">
                    <div className="meta-item">
                      <ClockIcon />
                      <span>
                        {facility.openingTime} - {facility.closingTime} ({facility.slotDurationMinutes} dk)
                      </span>
                    </div>
                    <div className="meta-item">
                      <UsersIcon />
                      <span>Kapasite: {facility.capacity} kişi</span>
                    </div>
                    {facility.locationHint && (
                      <div className="meta-item">
                        <LocationIcon />
                        <span>{facility.locationHint}</span>
                      </div>
                    )}
                  </div>

                  <div className="facility-card-footer">
                    <button
                      type="button"
                      className="btn btn-primary w-full"
                      onClick={() => handleOpenFacilityDetail(facility)}
                    >
                      Rezervasyon Yap / Detay
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : (
          /* MY RESERVATIONS VIEW */
          <div>
            <div className="sub-segmented-control" role="tablist">
              <button
                type="button"
                className={`sub-tab-btn ${reservationSubTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => setReservationSubTab('upcoming')}
              >
                Yaklaşan ({upcomingReservations.length})
              </button>
              <button
                type="button"
                className={`sub-tab-btn ${reservationSubTab === 'past' ? 'active' : ''}`}
                onClick={() => setReservationSubTab('past')}
              >
                Geçmiş ({pastReservations.length})
              </button>
            </div>

            {(reservationSubTab === 'upcoming' ? upcomingReservations : pastReservations).length === 0 ? (
              <div className="resident-empty-state-box">
                <div className="empty-icon-circle">
                  <CalendarIcon width={28} height={28} />
                </div>
                <h3>Henüz Rezervasyonunuz Yok</h3>
                <p className="empty-description">
                  Ortak alanlardan birini seçerek ilk rezervasyonunuzu oluşturabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tesis</th>
                      <th>Daire</th>
                      <th>Tarih & Saat</th>
                      <th>Durum</th>
                      <th>Gerekçe / Not</th>
                      <th className="text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reservationSubTab === 'upcoming' ? upcomingReservations : pastReservations).map((r) => {
                      const badge = STATUS_BADGE_MAP[r.status] || { label: r.status, className: 'status-badge secondary' }
                      const canCancel =
                        (r.status === 'PENDING' || r.status === 'APPROVED') &&
                        new Date(r.startTime).getTime() - Date.now() >= 0

                      return (
                        <tr key={r.id}>
                          <td className="font-semibold">{r.facilityName}</td>
                          <td>{r.buildingName} / D:{r.unitNumber}</td>
                          <td>{formatTimeRange(r.startTime, r.endTime)}</td>
                          <td>
                            <span className={badge.className}>{badge.label}</span>
                          </td>
                          <td className="text-xs text-muted">
                            {r.rejectionReason ? `Red Gerekçesi: ${r.rejectionReason}` : r.note || '—'}
                          </td>
                          <td className="text-right">
                            {canCancel && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm text-danger"
                                onClick={() => setCancellingReservation(r)}
                              >
                                İptal Et
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FACILITY DETAIL & BOOKING DRAWER */}
      {drawerAnimation.shouldRender && selectedFacility && (
        <>
          <button
            type="button"
            className={`drawer-backdrop drawer-${drawerAnimation.phase}`}
            aria-label="Tesis detayını kapat"
            disabled={drawerAnimation.isClosing || isSubmittingBooking}
            onClick={closeDrawer}
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className={`management-drawer drawer-${drawerAnimation.phase}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="facility-drawer-title"
          >
            <div className="drawer-header">
              <div>
                <span className="badge-context">
                  {selectedFacility.buildingName
                    ? `${selectedFacility.propertyName} / ${selectedFacility.buildingName}`
                    : selectedFacility.propertyName}
                </span>
                <h2 id="facility-drawer-title" className="text-xl font-bold">
                  {selectedFacility.name}
                </h2>
              </div>
              <button
                type="button"
                className="drawer-close-button"
                onClick={closeDrawer}
                aria-label="Kapat"
                disabled={isSubmittingBooking}
              >
                ✕
              </button>
            </div>

            <div className="drawer-body space-y-6">
              {/* Facility Details Card */}
              <div className="facility-rules-card">
                <h4 className="font-semibold text-sm mb-2 text-muted uppercase tracking-wider">Tesis Kuralları & Detaylar</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted">Açılış-Kapanış:</span>{' '}
                    <span className="font-medium">{selectedFacility.openingTime} - {selectedFacility.closingTime}</span>
                  </div>
                  <div>
                    <span className="text-muted">Slot Süresi:</span>{' '}
                    <span className="font-medium">{selectedFacility.slotDurationMinutes} Dakika</span>
                  </div>
                  <div>
                    <span className="text-muted">Max Aktif Hak:</span>{' '}
                    <span className="font-medium">{selectedFacility.maxActiveReservationsPerResident} Rezervasyon</span>
                  </div>
                  <div>
                    <span className="text-muted">İptal Süresi:</span>{' '}
                    <span className="font-medium">En geç {selectedFacility.cancellationLeadTimeHours} saat önce</span>
                  </div>
                </div>
                {selectedFacility.requiresManagerApproval && (
                  <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Bu tesis için yapılan rezervasyon talepleri site yönetiminin onayına gönderilir.
                  </div>
                )}
              </div>

              {/* Unit Selector (If resident has multiple units) */}
              {myUnits.length > 1 && (
                <div className="form-group">
                  <label htmlFor="unit-select" className="form-label">
                    Rezervasyon Yapılacak Daire
                  </label>
                  <select
                    id="unit-select"
                    className="form-input"
                    value={selectedUnitId || ''}
                    onChange={(e) => setSelectedUnitId(Number(e.target.value))}
                  >
                    {myUnits.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.buildingName} / D:{u.unitNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Selector */}
              <div className="form-group">
                <label htmlFor="booking-date" className="form-label">
                  Tarih Seçin
                </label>
                <input
                  id="booking-date"
                  type="date"
                  className="form-input"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </div>

              {/* Booking Error Banner */}
              {bookingError && (
                <div className="status-message error-message" role="alert">
                  {bookingError}
                </div>
              )}

              {/* Availability Slot Picker Grid */}
              <div className="form-group">
                <label className="form-label flex justify-between items-center">
                  <span>Müsait Saat Dilimleri ({selectedDate})</span>
                  {isLoadingAvailability && <span className="text-xs text-muted animate-pulse">Yükleniyor...</span>}
                </label>

                {isLoadingAvailability ? (
                  <LoadingSkeleton variant="table" rows={2} />
                ) : availability && availability.slots.length > 0 ? (
                  <div className="slot-grid">
                    {availability.slots.map((slot, index) => {
                      const startTimeDisplay = new Date(slot.startTime).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      const isSelected = selectedSlot?.startTime === slot.startTime
                      const isAvailable = slot.status === 'AVAILABLE'

                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={!isAvailable}
                          className={`slot-btn slot-status-${slot.status.toLowerCase()} ${
                            isSelected ? 'selected' : ''
                          }`}
                          onClick={() => setSelectedSlot(slot)}
                          title={slot.reason || undefined}
                        >
                          <span className="font-semibold">{startTimeDisplay}</span>
                          <span className="text-[10px] block opacity-80">
                            {slot.status === 'AVAILABLE'
                              ? 'Müsait'
                              : slot.status === 'BOOKED'
                              ? 'Dolu'
                              : slot.status === 'BLOCKED'
                              ? 'Bakım'
                              : 'Geçmiş'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Bu tarih için kullanılabilir saat dilimi bulunamadı.</p>
                )}
              </div>

              {/* Selected Slot Summary & Confirmation Form */}
              {selectedSlot && (
                <div className="booking-summary-card">
                  <h4 className="font-bold text-sm mb-2">Rezervasyon Özeti</h4>
                  <div className="text-sm space-y-1 text-muted">
                    <p>
                      <strong className="text-foreground">Tesis:</strong> {selectedFacility.name}
                    </p>
                    <p>
                      <strong className="text-foreground">Tarih & Saat:</strong>{' '}
                      {formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)}
                    </p>
                  </div>

                  <div className="form-group mt-3">
                    <label htmlFor="booking-note" className="form-label text-xs">
                      Not / Açıklama (İsteğe Bağlı)
                    </label>
                    <input
                      id="booking-note"
                      type="text"
                      className="form-input text-sm"
                      placeholder="Örn: 4 kişi katılım sağlayacağız"
                      value={bookingNote}
                      onChange={(e) => setBookingNote(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary w-full mt-3"
                    disabled={isSubmittingBooking}
                    onClick={handleCreateBooking}
                  >
                    {isSubmittingBooking ? 'Oluşturuluyor...' : 'Rezervasyonu Oluştur'}
                  </button>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Cancellation Confirmation Dialog */}
      {cancellingReservation && (
        <ConfirmationDialog
          title="Rezervasyon İptali"
          message={`${cancellingReservation.facilityName} tesisi için ${formatTimeRange(
            cancellingReservation.startTime,
            cancellingReservation.endTime
          )} tarihindeki rezervasyonunuzu iptal etmek istediğinize emin misiniz?`}
          confirmLabel="Evet, İptal Et"
          danger
          isLoading={isCancelling}
          onConfirm={handleCancelReservation}
          onCancel={() => setCancellingReservation(null)}
        />
      )}
    </section>
  )
}
