using System;
using System.Data;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class FacilityService : IFacilityService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _scopeService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimePublisher _realtimePublisher;

    public FacilityService(
        AppDbContext context,
        IManagerScopeService scopeService,
        INotificationService notificationService,
        IRealtimePublisher realtimePublisher)
    {
        _context = context;
        _scopeService = scopeService;
        _notificationService = notificationService;
        _realtimePublisher = realtimePublisher;
    }

    // --- MANAGEMENT - FACILITIES ---

    public async Task<List<CommonFacilityDto>> GetAllFacilitiesAsync(
        int userId,
        bool isAdmin,
        int? propertyId = null,
        int? buildingId = null,
        bool? isActive = null)
    {
        var query = _context.CommonFacilities
            .Include(f => f.Property)
            .Include(f => f.Building)
            .AsNoTracking();

        if (!isAdmin)
        {
            var accessiblePropIds = await _scopeService.GetAccessiblePropertyIdsAsync(userId, isAdmin: false);
            var accessibleBldgIds = await _scopeService.GetAccessibleBuildingIdsAsync(userId, isAdmin: false);

            query = query.Where(f => f.BuildingId.HasValue
                ? accessibleBldgIds.Contains(f.BuildingId.Value)
                : accessiblePropIds.Contains(f.PropertyId));
        }

        if (propertyId.HasValue)
        {
            query = query.Where(f => f.PropertyId == propertyId.Value);
        }

        if (buildingId.HasValue)
        {
            query = query.Where(f => f.BuildingId == buildingId.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(f => f.IsActive == isActive.Value);
        }

        var facilities = await query
            .OrderBy(f => f.Property.Name)
            .ThenBy(f => f.Name)
            .ToListAsync();

        return facilities.Select(MapFacilityToDto).ToList();
    }

    public async Task<CommonFacilityDto?> GetFacilityByIdAsync(int id, int userId, bool isAdmin)
    {
        var facility = await _context.CommonFacilities
            .Include(f => f.Property)
            .Include(f => f.Building)
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == id);

        if (facility is null) return null;

        await EnsureFacilityScopeAccessAsync(facility, userId, isAdmin);
        return MapFacilityToDto(facility);
    }

    public async Task<CommonFacilityDto> CreateFacilityAsync(CreateCommonFacilityDto dto, int currentUserId, bool isAdmin)
    {
        await ValidatePropertyAndBuildingAsync(dto.PropertyId, dto.BuildingId);

        var facility = new CommonFacility
        {
            PropertyId = dto.PropertyId,
            BuildingId = dto.BuildingId,
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            LocationHint = dto.LocationHint?.Trim(),
            Capacity = dto.Capacity,
            OpeningTime = ParseTimeSpan(dto.OpeningTime),
            ClosingTime = ParseTimeSpan(dto.ClosingTime),
            SlotDurationMinutes = dto.SlotDurationMinutes,
            RequiresManagerApproval = dto.RequiresManagerApproval,
            MaxActiveReservationsPerResident = dto.MaxActiveReservationsPerResident,
            CancellationLeadTimeHours = dto.CancellationLeadTimeHours,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await EnsureFacilityScopeAccessAsync(facility, currentUserId, isAdmin);

        _context.CommonFacilities.Add(facility);
        await _context.SaveChangesAsync();

        return (await GetFacilityByIdAsync(facility.Id, currentUserId, isAdmin))!;
    }

    public async Task<CommonFacilityDto> UpdateFacilityAsync(int id, UpdateCommonFacilityDto dto, int currentUserId, bool isAdmin)
    {
        var facility = await _context.CommonFacilities.FirstOrDefaultAsync(f => f.Id == id);
        if (facility is null)
        {
            throw new NotFoundException($"ID'si {id} olan ortak alan tesisi bulunamadı.");
        }

        await EnsureFacilityScopeAccessAsync(facility, currentUserId, isAdmin);

        facility.Name = dto.Name.Trim();
        facility.Description = dto.Description?.Trim();
        facility.LocationHint = dto.LocationHint?.Trim();
        facility.Capacity = dto.Capacity;
        facility.OpeningTime = ParseTimeSpan(dto.OpeningTime);
        facility.ClosingTime = ParseTimeSpan(dto.ClosingTime);
        facility.SlotDurationMinutes = dto.SlotDurationMinutes;
        facility.RequiresManagerApproval = dto.RequiresManagerApproval;
        facility.MaxActiveReservationsPerResident = dto.MaxActiveReservationsPerResident;
        facility.CancellationLeadTimeHours = dto.CancellationLeadTimeHours;
        facility.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await _realtimePublisher.PublishFacilityAvailabilityInvalidatedAsync(facility.Id, DateTime.UtcNow.ToString("yyyy-MM-dd"));

        return (await GetFacilityByIdAsync(facility.Id, currentUserId, isAdmin))!;
    }

    public async Task<CommonFacilityDto> SetFacilityActiveStatusAsync(int id, bool isActive, int currentUserId, bool isAdmin)
    {
        var facility = await _context.CommonFacilities.FirstOrDefaultAsync(f => f.Id == id);
        if (facility is null)
        {
            throw new NotFoundException($"ID'si {id} olan ortak alan tesisi bulunamadı.");
        }

        await EnsureFacilityScopeAccessAsync(facility, currentUserId, isAdmin);

        facility.IsActive = isActive;
        facility.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _realtimePublisher.PublishFacilityAvailabilityInvalidatedAsync(facility.Id, DateTime.UtcNow.ToString("yyyy-MM-dd"));

        return (await GetFacilityByIdAsync(facility.Id, currentUserId, isAdmin))!;
    }

    // --- MANAGEMENT - MAINTENANCE BLOCKS ---

    public async Task<List<FacilityMaintenanceBlockDto>> GetMaintenanceBlocksAsync(int facilityId, int userId, bool isAdmin)
    {
        var facility = await _context.CommonFacilities.AsNoTracking().FirstOrDefaultAsync(f => f.Id == facilityId);
        if (facility is null)
        {
            throw new NotFoundException($"ID'si {facilityId} olan ortak alan tesisi bulunamadı.");
        }

        await EnsureFacilityScopeAccessAsync(facility, userId, isAdmin);

        var blocks = await _context.FacilityMaintenanceBlocks
            .Include(b => b.Facility)
            .Include(b => b.CreatedByUser)
            .AsNoTracking()
            .Where(b => b.FacilityId == facilityId)
            .OrderByDescending(b => b.StartTime)
            .ToListAsync();

        return blocks.Select(MapBlockToDto).ToList();
    }

    public async Task<FacilityMaintenanceBlockDto> CreateMaintenanceBlockAsync(int facilityId, CreateMaintenanceBlockDto dto, int currentUserId, bool isAdmin)
    {
        var facility = await _context.CommonFacilities.FirstOrDefaultAsync(f => f.Id == facilityId);
        if (facility is null)
        {
            throw new NotFoundException($"ID'si {facilityId} olan ortak alan tesisi bulunamadı.");
        }

        await EnsureFacilityScopeAccessAsync(facility, currentUserId, isAdmin);

        if (dto.StartTime >= dto.EndTime)
        {
            throw new BadRequestException("Bakım başlangıç zamanı bitiş zamanından önce olmalıdır.");
        }

        // Check if overlaps with APPROVED reservation -> HTTP 409 Conflict
        var overlappingApproved = await _context.FacilityReservations
            .AsNoTracking()
            .AnyAsync(r => r.FacilityId == facilityId && r.Status == "APPROVED" && r.StartTime < dto.EndTime && r.EndTime > dto.StartTime);

        if (overlappingApproved)
        {
            throw new ConflictException("Belirtilen bakım zaman aralığında onaylanmış rezervasyon bulunmaktadır. Lütfen önce ilgili rezervasyonu yönetin.");
        }

        var block = new FacilityMaintenanceBlock
        {
            FacilityId = facilityId,
            StartTime = dto.StartTime,
            EndTime = dto.EndTime,
            Reason = dto.Reason.Trim(),
            CreatedByUserId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _context.FacilityMaintenanceBlocks.Add(block);
        await _context.SaveChangesAsync();

        await _realtimePublisher.PublishFacilityAvailabilityInvalidatedAsync(facilityId, dto.StartTime.ToString("yyyy-MM-dd"));

        var createdBlock = await _context.FacilityMaintenanceBlocks
            .Include(b => b.Facility)
            .Include(b => b.CreatedByUser)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == block.Id);

        return MapBlockToDto(createdBlock!);
    }

    public async Task DeleteMaintenanceBlockAsync(int blockId, int currentUserId, bool isAdmin)
    {
        var block = await _context.FacilityMaintenanceBlocks
            .Include(b => b.Facility)
            .FirstOrDefaultAsync(b => b.Id == blockId);

        if (block is null)
        {
            throw new NotFoundException($"ID'si {blockId} olan bakım engeli bulunamadı.");
        }

        await EnsureFacilityScopeAccessAsync(block.Facility, currentUserId, isAdmin);

        var dateStr = block.StartTime.ToString("yyyy-MM-dd");
        _context.FacilityMaintenanceBlocks.Remove(block);
        await _context.SaveChangesAsync();

        await _realtimePublisher.PublishFacilityAvailabilityInvalidatedAsync(block.FacilityId, dateStr);
    }

    // --- RESIDENT - AVAILABILITY & BOOKING ---

    public async Task<List<CommonFacilityDto>> GetResidentFacilitiesAsync(int residentUserId)
    {
        var utcNow = DateTime.UtcNow;

        var facilities = await _context.CommonFacilities
            .Include(f => f.Property)
            .Include(f => f.Building)
            .AsNoTracking()
            .Where(f => f.IsActive &&
                _context.UnitOccupancies.Any(occupancy =>
                    occupancy.UserId == residentUserId &&
                    occupancy.IsActive &&
                    occupancy.StartDate <= utcNow &&
                    (!occupancy.EndDate.HasValue || occupancy.EndDate.Value >= utcNow) &&
                    occupancy.Unit.IsActive &&
                    occupancy.Unit.Building.IsActive &&
                    occupancy.Unit.Building.Property.IsActive &&
                    occupancy.OccupancyType.IsActive &&
                    occupancy.Unit.Building.PropertyId == f.PropertyId &&
                    (!f.BuildingId.HasValue || occupancy.Unit.BuildingId == f.BuildingId.Value)))
            .OrderBy(f => f.Property.Name)
            .ThenBy(f => f.Name)
            .ToListAsync();

        return facilities.Select(MapFacilityToDto).ToList();
    }

    public async Task<FacilityAvailabilityDto> GetFacilityAvailabilityAsync(int facilityId, DateTime date, int residentUserId)
    {
        var facility = await _context.CommonFacilities
            .Include(f => f.Property)
            .Include(f => f.Building)
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == facilityId);

        if (facility is null || !facility.IsActive)
        {
            throw new NotFoundException($"ID'si {facilityId} olan aktif ortak alan tesisi bulunamadı.");
        }

        await EnsureResidentFacilityAccessAsync(facility, residentUserId);

        var dateOnly = date.Date;
        var dayStart = dateOnly.Add(facility.OpeningTime);
        var dayEnd = dateOnly.Add(facility.ClosingTime);
        var utcNow = DateTime.UtcNow;

        // Query active reservations for date
        var reservations = await _context.FacilityReservations
            .AsNoTracking()
            .Where(r => r.FacilityId == facilityId &&
                        (r.Status == "PENDING" || r.Status == "APPROVED") &&
                        r.StartTime < dayEnd && r.EndTime > dayStart)
            .ToListAsync();

        // Query maintenance blocks for date
        var blocks = await _context.FacilityMaintenanceBlocks
            .AsNoTracking()
            .Where(b => b.FacilityId == facilityId &&
                        b.StartTime < dayEnd && b.EndTime > dayStart)
            .ToListAsync();

        var slots = new List<TimeSlotDto>();
        var current = dayStart;
        var slotDuration = TimeSpan.FromMinutes(facility.SlotDurationMinutes);

        while (current.Add(slotDuration) <= dayEnd)
        {
            var slotEnd = current.Add(slotDuration);
            var status = "AVAILABLE";
            string? reason = null;

            if (slotEnd <= utcNow)
            {
                status = "PAST";
                reason = "Geçmiş zaman";
            }
            else if (blocks.Any(b => b.StartTime < slotEnd && b.EndTime > current))
            {
                status = "BLOCKED";
                reason = "Bakım/Kullanım Dışı";
            }
            else if (reservations.Any(r => r.StartTime < slotEnd && r.EndTime > current))
            {
                status = "BOOKED";
                reason = "Dolu";
            }

            slots.Add(new TimeSlotDto
            {
                StartTime = current,
                EndTime = slotEnd,
                Status = status,
                Reason = reason
            });

            current = slotEnd;
        }

        return new FacilityAvailabilityDto
        {
            FacilityId = facility.Id,
            FacilityName = facility.Name,
            Date = dateOnly.ToString("yyyy-MM-dd"),
            OpeningTime = facility.OpeningTime.ToString(@"hh\:mm"),
            ClosingTime = facility.ClosingTime.ToString(@"hh\:mm"),
            SlotDurationMinutes = facility.SlotDurationMinutes,
            Slots = slots
        };
    }

    public async Task<FacilityReservationDto> CreateReservationAsync(CreateReservationDto dto, int residentUserId)
    {
        if (dto.StartTime >= dto.EndTime)
        {
            throw new BadRequestException("Rezervasyon başlangıç zamanı bitiş zamanından önce olmalıdır.");
        }

        if (dto.StartTime <= DateTime.UtcNow)
        {
            throw new BadRequestException("Geçmiş bir zaman dilimi için rezervasyon oluşturulamaz.");
        }

        // Validate resident active occupancy
        var activeOccupancy = await _context.UnitOccupancies
            .Include(u => u.Unit)
            .ThenInclude(u => u.Building)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == residentUserId &&
                                      u.UnitId == dto.UnitId &&
                                      u.IsActive &&
                                      u.StartDate <= DateTime.UtcNow &&
                                      (!u.EndDate.HasValue || u.EndDate.Value >= DateTime.UtcNow));

        if (activeOccupancy is null)
        {
            throw new ForbiddenException("Seçilen dairede aktif sakini kaydınız bulunmamaktadır.");
        }

        // --- CONCURRENCY & SERIALIZATION ---
        // Acquire explicit SQL transaction + UPDLOCK/HOLDLOCK on Facility row to serialize concurrent booking requests for same facility
        await using var transaction = await _context.Database.BeginTransactionAsync();

        var facility = await _context.CommonFacilities
            .FromSqlRaw("SELECT * FROM CommonFacilities WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", dto.FacilityId)
            .FirstOrDefaultAsync();

        if (facility is null || !facility.IsActive)
        {
            throw new NotFoundException($"ID'si {dto.FacilityId} olan aktif tesis bulunamadı.");
        }

        // Validate facility scope access for resident unit
        if (facility.BuildingId.HasValue && facility.BuildingId.Value != activeOccupancy.Unit.BuildingId)
        {
            throw new ForbiddenException("Bu tesis sadece ilgili bloğun sakinleri tarafından rezerve edilebilir.");
        }
        if (!facility.BuildingId.HasValue && facility.PropertyId != activeOccupancy.Unit.Building.PropertyId)
        {
            throw new ForbiddenException("Bu tesis sizin sitenize ait değildir.");
        }

        // Validate opening hours
        var startLocalTime = dto.StartTime.TimeOfDay;
        var endLocalTime = dto.EndTime.TimeOfDay;
        if (startLocalTime < facility.OpeningTime || endLocalTime > facility.ClosingTime)
        {
            throw new BadRequestException($"Rezervasyon tesis açılış-kapanış saatleri ({facility.OpeningTime:hh\\:mm} - {facility.ClosingTime:hh\\:mm}) arasında olmalıdır.");
        }

        // Check overlapping active reservations under UPDLOCK
        var overlappingReservationExists = await _context.FacilityReservations
            .AnyAsync(r => r.FacilityId == dto.FacilityId &&
                           (r.Status == "PENDING" || r.Status == "APPROVED") &&
                           r.StartTime < dto.EndTime && r.EndTime > dto.StartTime);

        if (overlappingReservationExists)
        {
            throw new ConflictException("Seçtiğiniz zaman dilimi başka bir rezervasyon ile çakışmaktadır.");
        }

        // Check overlapping maintenance blocks
        var overlappingBlockExists = await _context.FacilityMaintenanceBlocks
            .AnyAsync(b => b.FacilityId == dto.FacilityId &&
                           b.StartTime < dto.EndTime && b.EndTime > dto.StartTime);

        if (overlappingBlockExists)
        {
            throw new ConflictException("Seçtiğiniz zaman dilimi tesis bakım çalışması nedeniyle kullanıma kapalıdır.");
        }

        // Check max active reservations limit for resident
        var activeCount = await _context.FacilityReservations
            .CountAsync(r => r.FacilityId == dto.FacilityId &&
                             r.ResidentUserId == residentUserId &&
                             (r.Status == "PENDING" || r.Status == "APPROVED") &&
                             r.EndTime > DateTime.UtcNow);

        if (activeCount >= facility.MaxActiveReservationsPerResident)
        {
            throw new BadRequestException($"Bu tesis için maksimum aktif rezervasyon limitinize ({facility.MaxActiveReservationsPerResident}) ulaştınız.");
        }

        var initialStatus = facility.RequiresManagerApproval ? "PENDING" : "APPROVED";

        var reservation = new FacilityReservation
        {
            FacilityId = dto.FacilityId,
            ResidentUserId = residentUserId,
            UnitId = dto.UnitId,
            StartTime = dto.StartTime,
            EndTime = dto.EndTime,
            Status = initialStatus,
            Note = dto.Note?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.FacilityReservations.Add(reservation);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        // Post-commit Realtime & Notifications
        await _realtimePublisher.PublishFacilityAvailabilityInvalidatedAsync(facility.Id, dto.StartTime.ToString("yyyy-MM-dd"));
        await _realtimePublisher.PublishActivityFeedInvalidatedAsync("RESERVATION");

        var managers = await ResolveFacilityScopeManagerUserIdsAsync(facility.PropertyId, facility.BuildingId);
        await _realtimePublisher.PublishFacilityReservationUpdatedAsync(
            new FacilityReservationUpdatedEvent
            {
                ReservationId = reservation.Id,
                FacilityId = facility.Id,
                Status = reservation.Status,
                UpdatedAt = DateTime.UtcNow.ToString("o")
            },
            managers.Concat(new[] { residentUserId }));

        return (await GetReservationByIdAsync(reservation.Id))!;
    }

    public async Task<FacilityReservationDto> CancelReservationAsync(long reservationId, int residentUserId)
    {
        var reservation = await _context.FacilityReservations
            .Include(r => r.Facility)
            .FirstOrDefaultAsync(r => r.Id == reservationId && r.ResidentUserId == residentUserId);

        if (reservation is null)
        {
            throw new NotFoundException($"ID'si {reservationId} olan rezervasyonunuz bulunamadı.");
        }

        if (reservation.Status != "PENDING" && reservation.Status != "APPROVED")
        {
            throw new BadRequestException($"Durumu '{reservation.Status}' olan rezervasyon iptal edilemez.");
        }

        var hoursUntilStart = (reservation.StartTime - DateTime.UtcNow).TotalHours;
        if (hoursUntilStart < reservation.Facility.CancellationLeadTimeHours)
        {
            throw new BadRequestException($"Rezervasyonlar en geç başlangıç saatinden {reservation.Facility.CancellationLeadTimeHours} saat öncesine kadar iptal edilebilir.");
        }

        reservation.Status = "CANCELLED";
        reservation.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _realtimePublisher.PublishFacilityAvailabilityInvalidatedAsync(reservation.FacilityId, reservation.StartTime.ToString("yyyy-MM-dd"));
        await _realtimePublisher.PublishActivityFeedInvalidatedAsync("RESERVATION");

        return (await GetReservationByIdAsync(reservation.Id))!;
    }

    public async Task<List<FacilityReservationDto>> GetMyReservationsAsync(int residentUserId)
    {
        var reservations = await _context.FacilityReservations
            .Include(r => r.Facility)
            .Include(r => r.ResidentUser)
            .Include(r => r.Unit)
            .ThenInclude(u => u.Building)
            .Include(r => r.ReviewedByUser)
            .AsNoTracking()
            .Where(r => r.ResidentUserId == residentUserId)
            .OrderByDescending(r => r.StartTime)
            .ToListAsync();

        return reservations.Select(MapReservationToDto).ToList();
    }

    // --- MANAGEMENT - RESERVATIONS ---

    public async Task<List<FacilityReservationDto>> GetManagementReservationsAsync(
        int userId,
        bool isAdmin,
        int? facilityId = null,
        int? propertyId = null,
        int? buildingId = null,
        string? status = null,
        DateTime? dateFrom = null,
        DateTime? dateTo = null)
    {
        var query = _context.FacilityReservations
            .Include(r => r.Facility)
            .Include(r => r.ResidentUser)
            .Include(r => r.Unit)
            .ThenInclude(u => u.Building)
            .Include(r => r.ReviewedByUser)
            .AsNoTracking();

        if (!isAdmin)
        {
            var accessiblePropIds = await _scopeService.GetAccessiblePropertyIdsAsync(userId, isAdmin: false);
            var accessibleBldgIds = await _scopeService.GetAccessibleBuildingIdsAsync(userId, isAdmin: false);

            query = query.Where(r => r.Facility.BuildingId.HasValue
                ? accessibleBldgIds.Contains(r.Facility.BuildingId.Value)
                : accessiblePropIds.Contains(r.Facility.PropertyId));
        }

        if (facilityId.HasValue) query = query.Where(r => r.FacilityId == facilityId.Value);
        if (propertyId.HasValue) query = query.Where(r => r.Facility.PropertyId == propertyId.Value);
        if (buildingId.HasValue) query = query.Where(r => r.Facility.BuildingId == buildingId.Value);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(r => r.Status == status);
        if (dateFrom.HasValue) query = query.Where(r => r.StartTime >= dateFrom.Value);
        if (dateTo.HasValue) query = query.Where(r => r.EndTime <= dateTo.Value);

        var list = await query
            .OrderByDescending(r => r.StartTime)
            .ToListAsync();

        return list.Select(MapReservationToDto).ToList();
    }

    public async Task<FacilityReservationDto> ApproveReservationAsync(long reservationId, int reviewerUserId, bool isAdmin)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();

        var reservation = await _context.FacilityReservations
            .Include(r => r.Facility)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation is null)
        {
            throw new NotFoundException($"ID'si {reservationId} olan rezervasyon bulunamadı.");
        }

        await EnsureFacilityScopeAccessAsync(reservation.Facility, reviewerUserId, isAdmin);

        if (reservation.Status != "PENDING")
        {
            throw new BadRequestException($"Durumu '{reservation.Status}' olan rezervasyon onaylanamaz.");
        }

        // Re-check overlap under UPDLOCK
        await _context.CommonFacilities
            .FromSqlRaw("SELECT * FROM CommonFacilities WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", reservation.FacilityId)
            .FirstOrDefaultAsync();

        var overlapApprovedExists = await _context.FacilityReservations
            .AnyAsync(r => r.FacilityId == reservation.FacilityId &&
                           r.Id != reservation.Id &&
                           r.Status == "APPROVED" &&
                           r.StartTime < reservation.EndTime && r.EndTime > reservation.StartTime);

        if (overlapApprovedExists)
        {
            throw new ConflictException("Bu zaman aralığı için daha önce onaylanmış başka bir rezervasyon mevcuttur.");
        }

        reservation.Status = "APPROVED";
        reservation.ReviewedByUserId = reviewerUserId;
        reservation.ReviewedAt = DateTime.UtcNow;
        reservation.UpdatedAt = DateTime.UtcNow;

        // Stage Notification
        var notif = await _notificationService.AddNotificationEntitiesForUsersAsync(
            new[] { reservation.ResidentUserId },
            "Rezervasyonunuz Onaylandı",
            $"{reservation.Facility.Name} tesisi için {reservation.StartTime:g} tarihindeki rezervasyonunuz onaylanmıştır.",
            "RESERVATION",
            "FacilityReservation",
            (int)reservation.Id);

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        if (notif.Count > 0)
        {
            await _realtimePublisher.PublishNotificationsAsync(notif.Select(n => _notificationService.ToDto(n)));
        }

        await _realtimePublisher.PublishFacilityAvailabilityInvalidatedAsync(reservation.FacilityId, reservation.StartTime.ToString("yyyy-MM-dd"));
        await _realtimePublisher.PublishActivityFeedInvalidatedAsync("RESERVATION");

        return (await GetReservationByIdAsync(reservation.Id))!;
    }

    public async Task<FacilityReservationDto> RejectReservationAsync(long reservationId, ReviewReservationDto dto, int reviewerUserId, bool isAdmin)
    {
        var reservation = await _context.FacilityReservations
            .Include(r => r.Facility)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation is null)
        {
            throw new NotFoundException($"ID'si {reservationId} olan rezervasyon bulunamadı.");
        }

        await EnsureFacilityScopeAccessAsync(reservation.Facility, reviewerUserId, isAdmin);

        if (reservation.Status != "PENDING")
        {
            throw new BadRequestException($"Durumu '{reservation.Status}' olan rezervasyon reddedilemez.");
        }

        reservation.Status = "REJECTED";
        reservation.RejectionReason = dto.RejectionReason?.Trim();
        reservation.ReviewedByUserId = reviewerUserId;
        reservation.ReviewedAt = DateTime.UtcNow;
        reservation.UpdatedAt = DateTime.UtcNow;

        var notif = await _notificationService.AddNotificationEntitiesForUsersAsync(
            new[] { reservation.ResidentUserId },
            "Rezervasyonunuz Reddedildi",
            $"{reservation.Facility.Name} tesisi için rezervasyonunuz reddedilmiştir." + (!string.IsNullOrWhiteSpace(reservation.RejectionReason) ? $" Gerekçe: {reservation.RejectionReason}" : ""),
            "RESERVATION",
            "FacilityReservation",
            (int)reservation.Id);

        await _context.SaveChangesAsync();

        if (notif.Count > 0)
        {
            await _realtimePublisher.PublishNotificationsAsync(notif.Select(n => _notificationService.ToDto(n)));
        }

        await _realtimePublisher.PublishFacilityAvailabilityInvalidatedAsync(reservation.FacilityId, reservation.StartTime.ToString("yyyy-MM-dd"));
        await _realtimePublisher.PublishActivityFeedInvalidatedAsync("RESERVATION");

        return (await GetReservationByIdAsync(reservation.Id))!;
    }

    // --- HELPER METHODS ---

    private async Task EnsureFacilityScopeAccessAsync(CommonFacility facility, int userId, bool isAdmin)
    {
        if (isAdmin) return;

        if (facility.BuildingId.HasValue)
        {
            var canAccessBldg = await _scopeService.CanAccessBuildingAsync(userId, facility.BuildingId.Value, isAdmin: false);
            if (!canAccessBldg)
            {
                throw new ForbiddenException("Bu tesise erişim yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            var canAccessProp = await _scopeService.CanViewPropertyAsync(userId, facility.PropertyId, isAdmin: false);
            if (!canAccessProp)
            {
                throw new ForbiddenException("Bu tesise erişim yetkiniz bulunmamaktadır.");
            }
        }
    }

    private async Task EnsureResidentFacilityAccessAsync(CommonFacility facility, int residentUserId)
    {
        var activeOccupancies = await _context.UnitOccupancies
            .Include(u => u.Unit)
            .ThenInclude(u => u.Building)
            .AsNoTracking()
            .Where(u => u.UserId == residentUserId &&
                        u.IsActive &&
                        u.StartDate <= DateTime.UtcNow &&
                        (!u.EndDate.HasValue || u.EndDate.Value >= DateTime.UtcNow))
            .ToListAsync();

        if (activeOccupancies.Count == 0)
        {
            throw new ForbiddenException("Aktif site sakini kaydınız bulunmamaktadır.");
        }

        var hasAccess = activeOccupancies.Any(u => facility.BuildingId.HasValue
            ? u.Unit.BuildingId == facility.BuildingId.Value
            : u.Unit.Building.PropertyId == facility.PropertyId);

        if (!hasAccess)
        {
            throw new ForbiddenException("Bu tesisin bağlı olduğu yapı veya blokta sakini kaydınız bulunmamaktadır.");
        }
    }

    private async Task ValidatePropertyAndBuildingAsync(int propertyId, int? buildingId)
    {
        var property = await _context.Properties.AsNoTracking().FirstOrDefaultAsync(p => p.Id == propertyId);
        if (property is null)
        {
            throw new NotFoundException($"ID'si {propertyId} olan site/yapı bulunamadı.");
        }

        if (buildingId.HasValue)
        {
            var building = await _context.Buildings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == buildingId.Value);
            if (building is null)
            {
                throw new NotFoundException($"ID'si {buildingId.Value} olan blok bulunamadı.");
            }

            if (building.PropertyId != propertyId)
            {
                throw new BadRequestException("Seçilen blok belirtilen yapıya ait değildir.");
            }
        }
    }

    private async Task<List<int>> ResolveFacilityScopeManagerUserIdsAsync(int propertyId, int? buildingId)
    {
        var query = _context.ManagerAssignments
            .AsNoTracking()
            .Where(m => m.IsActive && m.PropertyId == propertyId && (m.BuildingId == null || m.BuildingId == buildingId));

        return await query.Select(m => m.ManagerUserId).Distinct().ToListAsync();
    }

    private async Task<FacilityReservationDto?> GetReservationByIdAsync(long id)
    {
        var r = await _context.FacilityReservations
            .Include(r => r.Facility)
            .Include(r => r.ResidentUser)
            .Include(r => r.Unit)
            .ThenInclude(u => u.Building)
            .Include(r => r.ReviewedByUser)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);

        return r is null ? null : MapReservationToDto(r);
    }

    private static TimeSpan ParseTimeSpan(string timeStr)
    {
        if (TimeSpan.TryParse(timeStr, out var ts)) return ts;
        throw new BadRequestException($"Geçersiz saat formatı: {timeStr}. 'HH:mm' formatında giriniz.");
    }

    private static CommonFacilityDto MapFacilityToDto(CommonFacility f) => new()
    {
        Id = f.Id,
        PropertyId = f.PropertyId,
        PropertyName = f.Property?.Name ?? string.Empty,
        BuildingId = f.BuildingId,
        BuildingName = f.Building?.Name,
        Name = f.Name,
        Description = f.Description,
        LocationHint = f.LocationHint,
        Capacity = f.Capacity,
        OpeningTime = f.OpeningTime.ToString(@"hh\:mm"),
        ClosingTime = f.ClosingTime.ToString(@"hh\:mm"),
        SlotDurationMinutes = f.SlotDurationMinutes,
        RequiresManagerApproval = f.RequiresManagerApproval,
        MaxActiveReservationsPerResident = f.MaxActiveReservationsPerResident,
        CancellationLeadTimeHours = f.CancellationLeadTimeHours,
        IsActive = f.IsActive,
        CreatedAt = f.CreatedAt
    };

    private static FacilityReservationDto MapReservationToDto(FacilityReservation r) => new()
    {
        Id = r.Id,
        FacilityId = r.FacilityId,
        FacilityName = r.Facility?.Name ?? string.Empty,
        ResidentUserId = r.ResidentUserId,
        ResidentName = r.ResidentUser != null ? $"{r.ResidentUser.FirstName} {r.ResidentUser.LastName}".Trim() : string.Empty,
        UnitId = r.UnitId,
        UnitNumber = r.Unit?.UnitNumber ?? string.Empty,
        BuildingName = r.Unit?.Building?.Name ?? string.Empty,
        StartTime = r.StartTime,
        EndTime = r.EndTime,
        Status = r.Status,
        Note = r.Note,
        ReviewedByName = r.ReviewedByUser != null ? $"{r.ReviewedByUser.FirstName} {r.ReviewedByUser.LastName}".Trim() : null,
        ReviewedAt = r.ReviewedAt,
        RejectionReason = r.RejectionReason,
        CreatedAt = r.CreatedAt
    };

    private static FacilityMaintenanceBlockDto MapBlockToDto(FacilityMaintenanceBlock b) => new()
    {
        Id = b.Id,
        FacilityId = b.FacilityId,
        FacilityName = b.Facility?.Name ?? string.Empty,
        StartTime = b.StartTime,
        EndTime = b.EndTime,
        Reason = b.Reason,
        CreatedByName = b.CreatedByUser != null ? $"{b.CreatedByUser.FirstName} {b.CreatedByUser.LastName}".Trim() : string.Empty,
        CreatedAt = b.CreatedAt
    };
}
