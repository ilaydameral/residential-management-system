using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class VisitorService : IVisitorService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _scopeService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimePublisher _realtimePublisher;

    public VisitorService(
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

    public async Task<VisitorDto> CreateVisitorAsync(int residentUserId, CreateVisitorDto dto)
    {
        var now = DateTime.UtcNow;

        // Active Occupancy Rule: Resident may create visitor ONLY for active occupied unit
        var hasActiveOccupancy = await _context.UnitOccupancies
            .AsNoTracking()
            .AnyAsync(uo => uo.UserId == residentUserId
                            && uo.UnitId == dto.UnitId
                            && uo.IsActive
                            && uo.StartDate <= now
                            && (uo.EndDate == null || uo.EndDate > now));

        if (!hasActiveOccupancy)
        {
            throw new InvalidOperationException("Sadece aktif sakini olduğunuz daire için ziyaretçi kaydı oluşturabilirsiniz.");
        }

        // Validation
        var name = dto.VisitorName?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Ziyaretçi adı gereklidir.");
        }

        if (dto.ExpectedArrival >= dto.ExpectedDeparture)
        {
            throw new ArgumentException("Ziyaret başlangıç zamanı, bitiş zamanından önce olmalıdır.");
        }

        if (dto.ExpectedDeparture <= now)
        {
            throw new ArgumentException("Ziyaret bitiş zamanı gelecekte olmalıdır.");
        }

        var normalizedType = dto.VisitorType?.ToUpperInvariant() ?? "GUEST";
        var allowedTypes = new[] { "GUEST", "SERVICE_PROVIDER", "DELIVERY", "COMMERCIAL" };
        if (!allowedTypes.Contains(normalizedType))
        {
            normalizedType = "GUEST";
        }

        var normalizedPlate = string.IsNullOrWhiteSpace(dto.VehiclePlate)
            ? null
            : dto.VehiclePlate.Trim().ToUpperInvariant();

        var trimmedPhone = string.IsNullOrWhiteSpace(dto.VisitorPhone)
            ? null
            : dto.VisitorPhone.Trim();

        // Secure AccessCode generation with collision retry
        string accessCode = "";
        for (int i = 0; i < 5; i++)
        {
            var candidate = GenerateAccessCode();
            var exists = await _context.Visitors.AnyAsync(v => v.AccessCode == candidate);
            if (!exists)
            {
                accessCode = candidate;
                break;
            }
        }

        if (string.IsNullOrEmpty(accessCode))
        {
            accessCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
        }

        var visitor = new Visitor
        {
            HostUserId = residentUserId,
            UnitId = dto.UnitId,
            VisitorName = name,
            VisitorPhone = trimmedPhone,
            VisitorType = normalizedType,
            VehiclePlate = normalizedPlate,
            ExpectedArrival = dto.ExpectedArrival,
            ExpectedDeparture = dto.ExpectedDeparture,
            AccessCode = accessCode,
            Status = "EXPECTED",
            CreatedAt = now,
            UpdatedAt = now,
        };

        _context.Visitors.Add(visitor);
        await _context.SaveChangesAsync();

        return await GetVisitorDtoByIdAsync(visitor.Id);
    }

    public async Task<List<VisitorDto>> GetResidentVisitorsAsync(int residentUserId, string? statusFilter = null, bool? upcomingOnly = null)
    {
        // Auto-materialize EXPIRED visitors for this resident
        await MaterializeExpiredVisitorsAsync(_context.Visitors.Where(v => v.HostUserId == residentUserId));

        var query = _context.Visitors
            .AsNoTracking()
            .Include(v => v.HostUser)
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(v => v.CheckedInByUser)
            .Where(v => v.HostUserId == residentUserId);

        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            query = query.Where(v => v.Status == statusFilter.ToUpperInvariant());
        }

        if (upcomingOnly == true)
        {
            var now = DateTime.UtcNow;
            query = query.Where(v => v.ExpectedDeparture >= now && (v.Status == "EXPECTED" || v.Status == "CHECKED_IN"));
        }

        var visitors = await query
            .OrderByDescending(v => v.ExpectedArrival)
            .ToListAsync();

        return visitors.Select(ToDto).ToList();
    }

    public async Task<VisitorDto?> GetResidentVisitorByIdAsync(int residentUserId, long visitorId)
    {
        var visitor = await _context.Visitors
            .Include(v => v.HostUser)
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(v => v.CheckedInByUser)
            .FirstOrDefaultAsync(v => v.Id == visitorId && v.HostUserId == residentUserId);

        if (visitor == null) return null;

        var now = DateTime.UtcNow;
        if (visitor.Status == "EXPECTED" && visitor.ExpectedDeparture < now)
        {
            visitor.Status = "EXPIRED";
            visitor.UpdatedAt = now;
            await _context.SaveChangesAsync();
        }

        return ToDto(visitor);
    }

    public async Task<VisitorDto> CancelVisitorAsync(int residentUserId, long visitorId)
    {
        var visitor = await _context.Visitors
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
            .FirstOrDefaultAsync(v => v.Id == visitorId && v.HostUserId == residentUserId);

        if (visitor == null)
        {
            throw new KeyNotFoundException("Ziyaretçi kaydı bulunamadı.");
        }

        var now = DateTime.UtcNow;
        if (visitor.Status == "EXPECTED" && visitor.ExpectedDeparture < now)
        {
            visitor.Status = "EXPIRED";
            visitor.UpdatedAt = now;
            await _context.SaveChangesAsync();
            throw new InvalidOperationException("Ziyaret süresi dolduğu için iptal edilemez.");
        }

        if (visitor.Status != "EXPECTED")
        {
            throw new InvalidOperationException($"Yalnızca BEKLEYEN durumundaki ziyaretler iptal edilebilir. Mevcut durum: {visitor.Status}");
        }

        visitor.Status = "CANCELLED";
        visitor.UpdatedAt = now;
        await _context.SaveChangesAsync();

        var dto = await GetVisitorDtoByIdAsync(visitor.Id);

        // Publish SignalR event
        await PublishStatusChangedAsync(visitor);

        return dto;
    }

    public async Task<PagedVisitorResultDto> GetManagementVisitorsAsync(int userId, bool isAdmin, VisitorFilterDto filter)
    {
        // 1. Materialize expired visitors safely
        await MaterializeExpiredVisitorsAsync(_context.Visitors);

        var query = _context.Visitors
            .AsNoTracking()
            .Include(v => v.HostUser)
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(v => v.CheckedInByUser)
            .AsQueryable();

        // 2. Manager Scope Enforcement
        if (!isAdmin)
        {
            var accessibleBuildingIds = await _scopeService.GetAccessibleBuildingIdsAsync(userId, false);
            query = query.Where(v => accessibleBuildingIds.Contains(v.Unit.BuildingId));
        }

        // 3. Filters
        if (filter.PropertyId.HasValue)
        {
            query = query.Where(v => v.Unit.Building.PropertyId == filter.PropertyId.Value);
        }

        if (filter.BuildingId.HasValue)
        {
            query = query.Where(v => v.Unit.BuildingId == filter.BuildingId.Value);
        }

        if (filter.UnitId.HasValue)
        {
            query = query.Where(v => v.UnitId == filter.UnitId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            query = query.Where(v => v.Status == filter.Status.ToUpperInvariant());
        }

        if (!string.IsNullOrWhiteSpace(filter.VehiclePlate))
        {
            var plateUpper = filter.VehiclePlate.Trim().ToUpperInvariant();
            query = query.Where(v => v.VehiclePlate != null && v.VehiclePlate.Contains(plateUpper));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim();
            var sUpper = s.ToUpperInvariant();
            query = query.Where(v => v.VisitorName.Contains(s)
                                     || v.AccessCode == s
                                     || (v.VehiclePlate != null && v.VehiclePlate.Contains(sUpper)));
        }

        if (filter.DateFrom.HasValue)
        {
            query = query.Where(v => v.ExpectedArrival >= filter.DateFrom.Value);
        }

        if (filter.DateTo.HasValue)
        {
            query = query.Where(v => v.ExpectedDeparture <= filter.DateTo.Value);
        }

        var totalCount = await query.CountAsync();
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));

        var items = await query
            .OrderByDescending(v => v.ExpectedArrival)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedVisitorResultDto
        {
            Items = items.Select(ToDto).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
        };
    }

    public async Task<VisitorDto?> GetManagementVisitorByIdAsync(int userId, bool isAdmin, long visitorId)
    {
        var visitor = await _context.Visitors
            .Include(v => v.HostUser)
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(v => v.CheckedInByUser)
            .FirstOrDefaultAsync(v => v.Id == visitorId);

        if (visitor == null) return null;

        var canAccess = await _scopeService.CanAccessBuildingAsync(userId, visitor.Unit.BuildingId, isAdmin);
        if (!canAccess) return null;

        var now = DateTime.UtcNow;
        if (visitor.Status == "EXPECTED" && visitor.ExpectedDeparture < now)
        {
            visitor.Status = "EXPIRED";
            visitor.UpdatedAt = now;
            await _context.SaveChangesAsync();
        }

        return ToDto(visitor);
    }

    public async Task<VisitorDto> CheckInVisitorAsync(int managerUserId, bool isAdmin, long visitorId)
    {
        var visitor = await _context.Visitors
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
            .FirstOrDefaultAsync(v => v.Id == visitorId);

        if (visitor == null)
        {
            throw new KeyNotFoundException("Ziyaretçi kaydı bulunamadı.");
        }

        var canAccess = await _scopeService.CanAccessBuildingAsync(managerUserId, visitor.Unit.BuildingId, isAdmin);
        if (!canAccess)
        {
            throw new UnauthorizedAccessException("Bu ziyaretçi kaydı için işlem yapma yetkiniz yok.");
        }

        var now = DateTime.UtcNow;

        // Check-in allowed window: from 2 hours before ExpectedArrival until ExpectedDeparture
        if (now < visitor.ExpectedArrival.AddHours(-2))
        {
            throw new InvalidOperationException("Giriş zamanı henüz gelmedi. Ziyaret saatinden en fazla 2 saat önce giriş yapılabilir.");
        }

        if (now > visitor.ExpectedDeparture)
        {
            visitor.Status = "EXPIRED";
            visitor.UpdatedAt = now;
            await _context.SaveChangesAsync();
            throw new InvalidOperationException("Ziyaret süresi dolduğu için giriş yapılamaz.");
        }

        if (visitor.Status != "EXPECTED")
        {
            throw new InvalidOperationException($"Yalnızca BEKLEYEN durumundaki ziyaretçiler giriş yapabilir. Mevcut durum: {visitor.Status}");
        }

        visitor.Status = "CHECKED_IN";
        visitor.CheckedInAt = now;
        visitor.CheckedInByUserId = managerUserId;
        visitor.UpdatedAt = now;

        await _context.SaveChangesAsync();

        // 1. Send Notification to Host Resident
        var notificationEntities = await _notificationService.AddNotificationEntitiesForUsersAsync(
            new[] { visitor.HostUserId },
            "Ziyaretçi Girişi Yapıldı",
            $"{visitor.VisitorName} isimli ziyaretçiniz siteye/binaya giriş yaptı.",
            "VISITOR_CHECKED_IN",
            "Visitor",
            (int)visitor.Id
        );
        await _context.SaveChangesAsync();

        var notificationDtos = notificationEntities.Select(_notificationService.ToDto).ToList();
        await _realtimePublisher.PublishNotificationsAsync(notificationDtos);

        // 2. Publish SignalR event
        await PublishStatusChangedAsync(visitor);

        return await GetVisitorDtoByIdAsync(visitor.Id);
    }

    public async Task<VisitorDto> CheckOutVisitorAsync(int managerUserId, bool isAdmin, long visitorId)
    {
        var visitor = await _context.Visitors
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
            .FirstOrDefaultAsync(v => v.Id == visitorId);

        if (visitor == null)
        {
            throw new KeyNotFoundException("Ziyaretçi kaydı bulunamadı.");
        }

        var canAccess = await _scopeService.CanAccessBuildingAsync(managerUserId, visitor.Unit.BuildingId, isAdmin);
        if (!canAccess)
        {
            throw new UnauthorizedAccessException("Bu ziyaretçi kaydı için işlem yapma yetkiniz yok.");
        }

        if (visitor.Status != "CHECKED_IN")
        {
            throw new InvalidOperationException($"Yalnızca GİRİŞ YAPMIŞ durumdaki ziyaretçiler çıkış yapabilir. Mevcut durum: {visitor.Status}");
        }

        var now = DateTime.UtcNow;
        visitor.Status = "CHECKED_OUT";
        visitor.CheckedOutAt = now;
        visitor.UpdatedAt = now;

        await _context.SaveChangesAsync();

        // Publish SignalR event
        await PublishStatusChangedAsync(visitor);

        return await GetVisitorDtoByIdAsync(visitor.Id);
    }

    // Helper methods
    private async Task MaterializeExpiredVisitorsAsync(IQueryable<Visitor> query)
    {
        var now = DateTime.UtcNow;
        var expiredList = await query
            .Where(v => v.Status == "EXPECTED" && v.ExpectedDeparture < now)
            .ToListAsync();

        if (expiredList.Any())
        {
            foreach (var v in expiredList)
            {
                v.Status = "EXPIRED";
                v.UpdatedAt = now;
            }
            await _context.SaveChangesAsync();
        }
    }

    private async Task PublishStatusChangedAsync(Visitor visitor)
    {
        var evt = new VisitorStatusChangedEvent
        {
            VisitorId = visitor.Id,
            UnitId = visitor.UnitId,
            Status = visitor.Status,
            UpdatedAt = visitor.UpdatedAt,
        };

        var targetUsers = new List<int> { visitor.HostUserId };

        // Find managers who have access to this unit's building
        var buildingManagers = await _context.ManagerAssignments
            .AsNoTracking()
            .Where(ma => ma.IsActive && (ma.BuildingId == visitor.Unit.BuildingId
                         || (ma.PropertyId == visitor.Unit.Building.PropertyId && ma.BuildingId == null)))
            .Select(ma => ma.ManagerUserId)
            .ToListAsync();

        targetUsers.AddRange(buildingManagers);

        await _realtimePublisher.PublishVisitorStatusChangedAsync(evt, targetUsers.Distinct());
    }

    private async Task<VisitorDto> GetVisitorDtoByIdAsync(long visitorId)
    {
        var visitor = await _context.Visitors
            .AsNoTracking()
            .Include(v => v.HostUser)
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(v => v.CheckedInByUser)
            .FirstAsync(v => v.Id == visitorId);

        return ToDto(visitor);
    }

    private static string GenerateAccessCode()
    {
        var number = RandomNumberGenerator.GetInt32(100000, 1000000);
        return number.ToString("D6");
    }

    private static VisitorDto ToDto(Visitor v)
    {
        return new VisitorDto
        {
            Id = v.Id,
            HostUserId = v.HostUserId,
            HostUserName = v.HostUser != null ? $"{v.HostUser.FirstName} {v.HostUser.LastName}".Trim() : "",
            UnitId = v.UnitId,
            UnitNumber = v.Unit?.UnitNumber ?? "",
            BuildingName = v.Unit?.Building?.Name ?? "",
            PropertyName = v.Unit?.Building?.Property?.Name ?? "",
            PropertyId = v.Unit?.Building?.PropertyId ?? 0,
            BuildingId = v.Unit?.BuildingId ?? 0,
            VisitorName = v.VisitorName,
            VisitorPhone = v.VisitorPhone,
            VisitorType = v.VisitorType,
            VehiclePlate = v.VehiclePlate,
            ExpectedArrival = v.ExpectedArrival,
            ExpectedDeparture = v.ExpectedDeparture,
            AccessCode = v.AccessCode,
            Status = v.Status,
            CheckedInAt = v.CheckedInAt,
            CheckedInByUserName = v.CheckedInByUser != null ? $"{v.CheckedInByUser.FirstName} {v.CheckedInByUser.LastName}".Trim() : null,
            CheckedOutAt = v.CheckedOutAt,
            CreatedAt = v.CreatedAt,
            UpdatedAt = v.UpdatedAt,
        };
    }
}
