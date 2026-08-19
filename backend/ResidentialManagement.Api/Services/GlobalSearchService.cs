using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public class GlobalSearchService : IGlobalSearchService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;

    public GlobalSearchService(AppDbContext context, IManagerScopeService managerScopeService)
    {
        _context = context;
        _managerScopeService = managerScopeService;
    }

    public async Task<GlobalSearchResponseDto> SearchAsync(string query, int limit, int userId, bool isAdmin)
    {
        var term = query.Trim();
        var clampedLimit = Math.Clamp(limit, 1, 10);
        var now = DateTime.UtcNow;

        var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(userId, isAdmin);
        var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(userId, isAdmin);

        var response = new GlobalSearchResponseDto
        {
            Query = term
        };

        // 1. PROPERTIES
        response.Properties = await _context.Properties
            .AsNoTracking()
            .Where(p => (isAdmin || accessiblePropertyIds.Contains(p.Id)) &&
                        EF.Functions.Like(p.Name, $"%{term}%"))
            .OrderBy(p => p.Name.StartsWith(term) ? 0 : 1)
            .ThenBy(p => p.Name)
            .Take(clampedLimit)
            .Select(p => new GlobalSearchItemDto
            {
                Id = p.Id,
                Title = p.Name,
                Subtitle = "Site / Gayrimenkul",
                EntityType = "PROPERTY",
                TargetView = "properties",
                RouteParams = new Dictionary<string, string> { { "propertyId", p.Id.ToString() } }
            })
            .ToListAsync();

        // 2. BUILDINGS
        response.Buildings = await _context.Buildings
            .AsNoTracking()
            .Include(b => b.Property)
            .Where(b => (isAdmin || accessibleBuildingIds.Contains(b.Id)) &&
                        (EF.Functions.Like(b.Name, $"%{term}%") || (b.Code != null && EF.Functions.Like(b.Code, $"%{term}%"))))
            .OrderBy(b => b.Name.StartsWith(term) ? 0 : 1)
            .ThenBy(b => b.Name)
            .Take(clampedLimit)
            .Select(b => new GlobalSearchItemDto
            {
                Id = b.Id,
                Title = b.Name,
                Subtitle = b.Property != null ? b.Property.Name : "Blok",
                EntityType = "BUILDING",
                TargetView = "buildings",
                RouteParams = new Dictionary<string, string> { { "buildingId", b.Id.ToString() }, { "propertyId", b.PropertyId.ToString() } }
            })
            .ToListAsync();

        // 3. UNITS
        response.Units = await _context.Units
            .AsNoTracking()
            .Include(u => u.Building)
            .ThenInclude(b => b.Property)
            .Where(u => (isAdmin || accessibleBuildingIds.Contains(u.BuildingId)) &&
                        (EF.Functions.Like(u.UnitNumber, $"%{term}%") ||
                         EF.Functions.Like(u.Building.Name, $"%{term}%") ||
                         EF.Functions.Like(u.Building.Property.Name, $"%{term}%")))
            .OrderBy(u => u.UnitNumber == term ? 0 : u.UnitNumber.StartsWith(term) ? 1 : 2)
            .ThenBy(u => u.UnitNumber)
            .Take(clampedLimit)
            .Select(u => new GlobalSearchItemDto
            {
                Id = u.Id,
                Title = $"Daire {u.UnitNumber}",
                Subtitle = $"{u.Building.Property.Name} / {u.Building.Name}",
                EntityType = "UNIT",
                TargetView = "units",
                RouteParams = new Dictionary<string, string> { { "unitId", u.Id.ToString() }, { "buildingId", u.BuildingId.ToString() } }
            })
            .ToListAsync();

        // 4. USERS / RESIDENTS
        if (isAdmin)
        {
            response.Users = await _context.Users
                .AsNoTracking()
                .Where(u => EF.Functions.Like(u.FirstName, $"%{term}%") ||
                            EF.Functions.Like(u.LastName, $"%{term}%") ||
                            (u.Email != null && EF.Functions.Like(u.Email, $"%{term}%")))
                .OrderBy(u => u.FirstName.StartsWith(term) ? 0 : 1)
                .ThenBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .Take(clampedLimit)
                .Select(u => new GlobalSearchItemDto
                {
                    Id = u.Id,
                    Title = $"{u.FirstName} {u.LastName}".Trim(),
                    Subtitle = u.Email ?? "Kullanıcı",
                    EntityType = "USER",
                    TargetView = "users",
                    RouteParams = new Dictionary<string, string> { { "userId", u.Id.ToString() } }
                })
                .ToListAsync();
        }
        else
        {
            // MANAGER: Only return RESIDENT users who currently have an ACTIVE UnitOccupancy in an accessible building.
            var activeResidentUserIdsQuery = _context.UnitOccupancies
                .AsNoTracking()
                .Where(o => o.IsActive &&
                            (o.EndDate == null || o.EndDate > now) &&
                            accessibleBuildingIds.Contains(o.Unit.BuildingId))
                .Select(o => o.UserId)
                .Distinct();

            response.Users = await _context.Users
                .AsNoTracking()
                .Where(u => activeResidentUserIdsQuery.Contains(u.Id) &&
                            u.UserRoles.Any(ur => ur.Role.Code == "RESIDENT") &&
                            (EF.Functions.Like(u.FirstName, $"%{term}%") ||
                             EF.Functions.Like(u.LastName, $"%{term}%") ||
                             (u.Email != null && EF.Functions.Like(u.Email, $"%{term}%"))))
                .OrderBy(u => u.FirstName.StartsWith(term) ? 0 : 1)
                .ThenBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .Take(clampedLimit)
                .Select(u => new GlobalSearchItemDto
                {
                    Id = u.Id,
                    Title = $"{u.FirstName} {u.LastName}".Trim(),
                    Subtitle = u.Email ?? "Sakin",
                    EntityType = "USER",
                    TargetView = "users",
                    RouteParams = new Dictionary<string, string> { { "userId", u.Id.ToString() } }
                })
                .ToListAsync();
        }

        // 5. MAINTENANCE REQUESTS
        response.MaintenanceRequests = await _context.MaintenanceRequests
            .AsNoTracking()
            .Include(m => m.Building)
            .ThenInclude(b => b.Property)
            .Include(m => m.Unit)
            .Where(m => (isAdmin || accessibleBuildingIds.Contains(m.BuildingId)) &&
                        (EF.Functions.Like(m.RequestNumber, $"%{term}%") ||
                         EF.Functions.Like(m.Title, $"%{term}%")))
            .OrderBy(m => m.RequestNumber.StartsWith(term) ? 0 : 1)
            .ThenByDescending(m => m.CreatedAt)
            .Take(clampedLimit)
            .Select(m => new GlobalSearchItemDto
            {
                Id = m.Id,
                Title = $"{m.RequestNumber} · {m.Title}",
                Subtitle = $"{m.Building.Property.Name} / {m.Building.Name} / D:{m.Unit.UnitNumber}",
                EntityType = "MAINTENANCE",
                TargetView = "maintenance-requests",
                RouteParams = new Dictionary<string, string> { { "requestId", m.Id.ToString() } }
            })
            .ToListAsync();

        // 6. ANNOUNCEMENTS
        response.Announcements = await _context.Announcements
            .AsNoTracking()
            .Include(a => a.Property)
            .Include(a => a.Building)
            .Where(a => (isAdmin || (a.BuildingId != null ? accessibleBuildingIds.Contains(a.BuildingId.Value) : accessiblePropertyIds.Contains(a.PropertyId))) &&
                        EF.Functions.Like(a.Title, $"%{term}%"))
            .OrderBy(a => a.Title.StartsWith(term) ? 0 : 1)
            .ThenByDescending(a => a.CreatedAt)
            .Take(clampedLimit)
            .Select(a => new GlobalSearchItemDto
            {
                Id = a.Id,
                Title = a.Title,
                Subtitle = a.Building != null ? $"{a.Property.Name} / {a.Building.Name}" : $"{a.Property.Name} (Site Geneli)",
                EntityType = "ANNOUNCEMENT",
                TargetView = "announcements",
                RouteParams = new Dictionary<string, string> { { "announcementId", a.Id.ToString() } }
            })
            .ToListAsync();

        return response;
    }
}
