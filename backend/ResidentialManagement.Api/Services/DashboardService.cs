using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public class DashboardService : IDashboardService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _scopeService;

    public DashboardService(AppDbContext context, IManagerScopeService scopeService)
    {
        _context = context;
        _scopeService = scopeService;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(
        IReadOnlyCollection<int>? accessiblePropertyIds = null,
        IReadOnlyCollection<int>? accessibleBuildingIds = null)
    {
        var utcNow = DateTime.UtcNow;

        var properties = _context.Properties
            .AsNoTracking()
            .Where(property => property.IsActive);

        if (accessiblePropertyIds is not null)
        {
            properties = properties.Where(property =>
                accessiblePropertyIds.Contains(property.Id));
        }

        var propertyCount = await properties.CountAsync();

        var buildings = _context.Buildings
            .AsNoTracking()
            .Where(building => building.IsActive && building.Property.IsActive);

        if (accessibleBuildingIds is not null)
        {
            buildings = buildings.Where(building =>
                accessibleBuildingIds.Contains(building.Id));
        }

        var buildingCount = await buildings.CountAsync();

        var activeUnits = _context.Units
            .AsNoTracking()
            .Where(unit =>
                unit.IsActive &&
                unit.Building.IsActive &&
                unit.Building.Property.IsActive);

        if (accessibleBuildingIds is not null)
        {
            activeUnits = activeUnits.Where(unit =>
                accessibleBuildingIds.Contains(unit.BuildingId));
        }

        var unitCount = await activeUnits.CountAsync();

        var activeOccupancies = _context.UnitOccupancies
            .AsNoTracking()
            .Where(occupancy =>
                occupancy.IsActive &&
                occupancy.StartDate <= utcNow &&
                (!occupancy.EndDate.HasValue || occupancy.EndDate.Value >= utcNow) &&
                occupancy.Unit.IsActive &&
                occupancy.Unit.Building.IsActive &&
                occupancy.Unit.Building.Property.IsActive);

        if (accessibleBuildingIds is not null)
        {
            activeOccupancies = activeOccupancies.Where(occupancy =>
                accessibleBuildingIds.Contains(occupancy.Unit.BuildingId));
        }

        var activeOccupancyCount = await activeOccupancies.CountAsync();
        var occupiedUnitCount = await activeOccupancies
            .Select(occupancy => occupancy.UnitId)
            .Distinct()
            .CountAsync();

        return new DashboardSummaryDto
        {
            PropertyCount = propertyCount,
            BuildingCount = buildingCount,
            UnitCount = unitCount,
            ActiveOccupancyCount = activeOccupancyCount,
            OccupiedUnitCount = occupiedUnitCount,
            VacantUnitCount = unitCount - occupiedUnitCount
        };
    }

    public async Task<List<ActivityFeedItemDto>> GetActivityFeedAsync(int limit, int userId, bool isAdmin)
    {
        if (limit < 5) limit = 5;
        if (limit > 30) limit = 30;

        List<int>? propFilter = null;
        List<int>? bldgFilter = null;
        if (!isAdmin)
        {
            propFilter = await _scopeService.GetAccessiblePropertyIdsAsync(userId, isAdmin: false);
            bldgFilter = await _scopeService.GetAccessibleBuildingIdsAsync(userId, isAdmin: false);
        }

        var items = new List<ActivityFeedItemDto>();
        int fetchCount = limit * 2;

        // 1. MAINTENANCE REQUEST HISTORY
        var maintQuery = _context.MaintenanceRequestHistories
            .AsNoTracking()
            .Where(h => h.ActionType != "NOTE_ADDED");

        if (bldgFilter != null)
        {
            maintQuery = maintQuery.Where(h => bldgFilter.Contains(h.MaintenanceRequest.BuildingId));
        }

        var maintHistories = await maintQuery
            .OrderByDescending(h => h.CreatedAt)
            .Take(fetchCount)
            .Select(h => new ActivityFeedItemDto
            {
                Id = "maint_" + h.Id,
                Category = "MAINTENANCE",
                ActivityType = h.ActionType,
                Title = h.ActionType == "CREATED" ? "Yeni Bakım Talebi" :
                        h.ActionType == "ASSIGNED" ? "Teknik Personel Atandı" :
                        h.ActionType == "RESOLVED" ? "Talep Çözüldü" :
                        h.ActionType == "CLOSED" ? "Talep Kapatıldı" :
                        h.ActionType == "CANCELLED" ? "Talep İptal Edildi" :
                        h.ActionType == "REOPENED" ? "Talep Yeniden Açıldı" : "Talep Durumu Güncellendi",
                Description = $"#{h.MaintenanceRequest.RequestNumber} · {h.MaintenanceRequest.Building.Name} / D:{h.MaintenanceRequest.Unit.UnitNumber} - {h.MaintenanceRequest.Title}",
                ActorName = (h.ChangedByUser.FirstName + " " + h.ChangedByUser.LastName).Trim(),
                OccurredAt = h.CreatedAt,
                PropertyId = h.MaintenanceRequest.PropertyId,
                BuildingId = h.MaintenanceRequest.BuildingId,
                UnitId = h.MaintenanceRequest.UnitId,
                RelatedEntityId = h.MaintenanceRequestId,
                TargetView = "maintenanceRequests",
                RouteParams = $"requestId={h.MaintenanceRequestId}"
            })
            .ToListAsync();

        items.AddRange(maintHistories);

        // 2. ANNOUNCEMENTS (PUBLISHED)
        var annQuery = _context.Announcements
            .AsNoTracking()
            .Where(a => a.Status == "PUBLISHED" && a.PublishedAt != null);

        if (bldgFilter != null && propFilter != null)
        {
            annQuery = annQuery.Where(a => a.BuildingId.HasValue
                ? bldgFilter.Contains(a.BuildingId.Value)
                : propFilter.Contains(a.PropertyId));
        }

        var announcements = await annQuery
            .OrderByDescending(a => a.PublishedAt)
            .Take(fetchCount)
            .Select(a => new ActivityFeedItemDto
            {
                Id = "ann_" + a.Id,
                Category = "ANNOUNCEMENT",
                ActivityType = "ANNOUNCEMENT_PUBLISHED",
                Title = "Duyuru Yayınlandı",
                Description = a.Title + (a.Building != null ? $" ({a.Building.Name})" : $" ({a.Property.Name})"),
                ActorName = (a.CreatedByUser.FirstName + " " + a.CreatedByUser.LastName).Trim(),
                OccurredAt = a.PublishedAt!.Value,
                PropertyId = a.PropertyId,
                BuildingId = a.BuildingId,
                RelatedEntityId = a.Id,
                TargetView = "announcements",
                RouteParams = $"announcementId={a.Id}"
            })
            .ToListAsync();

        items.AddRange(announcements);

        // 3. PAYMENT SUBMISSIONS (SUBMITTED & REVIEWED)
        var payQuery = _context.PaymentSubmissions
            .AsNoTracking()
            .AsQueryable();

        if (bldgFilter != null)
        {
            payQuery = payQuery.Where(p => bldgFilter.Contains(p.UnitCharge.Unit.BuildingId));
        }

        var rawPayments = await payQuery
            .OrderByDescending(p => p.CreatedAt)
            .Take(fetchCount)
            .Select(p => new
            {
                p.Id,
                p.Amount,
                p.Status,
                p.CreatedAt,
                p.ReviewedAt,
                SubmittedByName = (p.SubmittedByUser.FirstName + " " + p.SubmittedByUser.LastName).Trim(),
                ReviewedByName = p.ReviewedByUser != null ? (p.ReviewedByUser.FirstName + " " + p.ReviewedByUser.LastName).Trim() : null,
                ChargeTitle = p.UnitCharge.Title,
                UnitNumber = p.UnitCharge.Unit.UnitNumber,
                BuildingName = p.UnitCharge.Unit.Building.Name,
                p.UnitCharge.Unit.BuildingId,
                p.UnitCharge.Unit.Building.PropertyId,
                p.UnitCharge.UnitId
            })
            .ToListAsync();

        foreach (var p in rawPayments)
        {
            items.Add(new ActivityFeedItemDto
            {
                Id = $"pay_sub_{p.Id}",
                Category = "FINANCE",
                ActivityType = "PAYMENT_SUBMITTED",
                Title = "Ödeme Bildirimi Alındı",
                Description = $"{p.BuildingName} / D:{p.UnitNumber} · {p.Amount:N2} TL ({p.ChargeTitle})",
                ActorName = p.SubmittedByName,
                OccurredAt = p.CreatedAt,
                PropertyId = p.PropertyId,
                BuildingId = p.BuildingId,
                UnitId = p.UnitId,
                RelatedEntityId = p.Id,
                TargetView = "paymentSubmissions",
                RouteParams = ""
            });

            if (p.ReviewedAt.HasValue && (p.Status == "APPROVED" || p.Status == "REJECTED"))
            {
                items.Add(new ActivityFeedItemDto
                {
                    Id = $"pay_rev_{p.Id}",
                    Category = "FINANCE",
                    ActivityType = p.Status == "APPROVED" ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED",
                    Title = p.Status == "APPROVED" ? "Ödeme Onaylandı" : "Ödeme Reddedildi",
                    Description = $"{p.BuildingName} / D:{p.UnitNumber} · {p.Amount:N2} TL ({p.ChargeTitle})",
                    ActorName = p.ReviewedByName ?? "Yönetici",
                    OccurredAt = p.ReviewedAt.Value,
                    PropertyId = p.PropertyId,
                    BuildingId = p.BuildingId,
                    UnitId = p.UnitId,
                    RelatedEntityId = p.Id,
                    TargetView = "paymentSubmissions",
                    RouteParams = ""
                });
            }
        }

        // 4. UNIT OCCUPANCIES (RESIDENT MOVED IN)
        var occQuery = _context.UnitOccupancies
            .AsNoTracking()
            .AsQueryable();

        if (bldgFilter != null)
        {
            occQuery = occQuery.Where(u => bldgFilter.Contains(u.Unit.BuildingId));
        }

        var occupancies = await occQuery
            .OrderByDescending(u => u.StartDate)
            .Take(fetchCount)
            .Select(u => new ActivityFeedItemDto
            {
                Id = "occ_" + u.Id,
                Category = "OCCUPANCY",
                ActivityType = "RESIDENT_MOVED_IN",
                Title = "Yeni Sakin Girişi",
                Description = $"{u.Unit.Building.Name} / D:{u.Unit.UnitNumber} - {u.User.FirstName} {u.User.LastName} ({u.OccupancyType.Name})",
                ActorName = (u.User.FirstName + " " + u.User.LastName).Trim(),
                OccurredAt = u.StartDate,
                PropertyId = u.Unit.Building.PropertyId,
                BuildingId = u.Unit.BuildingId,
                UnitId = u.UnitId,
                RelatedEntityId = u.Id,
                TargetView = "units",
                RouteParams = $"unitId={u.UnitId}"
            })
            .ToListAsync();

        items.AddRange(occupancies);

        // 5. MANAGER ASSIGNMENTS (MANAGER ASSIGNED)
        var mgrQuery = _context.ManagerAssignments
            .AsNoTracking()
            .Where(m => m.IsActive);

        if (bldgFilter != null && propFilter != null)
        {
            mgrQuery = mgrQuery.Where(m => m.BuildingId.HasValue
                ? bldgFilter.Contains(m.BuildingId.Value)
                : propFilter.Contains(m.PropertyId));
        }

        var mgrAssignments = await mgrQuery
            .OrderByDescending(m => m.AssignedAt)
            .Take(fetchCount)
            .Select(m => new ActivityFeedItemDto
            {
                Id = "mgt_" + m.Id,
                Category = "MANAGEMENT",
                ActivityType = "MANAGER_ASSIGNED",
                Title = "Site Yöneticisi Atandı",
                Description = $"{m.ManagerUser.FirstName} {m.ManagerUser.LastName} - " + (m.Building != null ? m.Building.Name : m.Property.Name),
                ActorName = (m.AssignedByUser.FirstName + " " + m.AssignedByUser.LastName).Trim(),
                OccurredAt = m.AssignedAt,
                PropertyId = m.PropertyId,
                BuildingId = m.BuildingId,
                RelatedEntityId = m.Id,
                TargetView = "managerAssignments",
                RouteParams = ""
            })
            .ToListAsync();

        items.AddRange(mgrAssignments);

        return items
            .OrderByDescending(i => i.OccurredAt)
            .Take(limit)
            .ToList();
    }
}
