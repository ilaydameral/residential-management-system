using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class BuildingService : IBuildingService
{
    private readonly AppDbContext _context;

    public BuildingService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<BuildingDto>> GetAllBuildingsAsync(
        bool includeInactive = false,
        IReadOnlyCollection<int>? accessibleBuildingIds = null)
    {
        var query = _context.Buildings
            .AsNoTracking()
            .Include(b => b.Property)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(b => b.IsActive);
        }

        if (accessibleBuildingIds is not null)
        {
            query = query.Where(b => accessibleBuildingIds.Contains(b.Id));
        }

        return await query
            .OrderBy(b => b.PropertyId)
            .ThenBy(b => b.Code)
            .Select(b => new BuildingDto
            {
                Id = b.Id,
                PropertyId = b.PropertyId,
                PropertyName = b.Property.Name,
                Name = b.Name,
                Code = b.Code,
                FloorCount = b.FloorCount,
                Description = b.Description,
                IsActive = b.IsActive,
                UnitCount = b.Units.Count,
                CreatedAt = b.CreatedAt,
                UpdatedAt = b.UpdatedAt
            })
            .ToListAsync();
    }

    public async Task<BuildingDto?> GetBuildingByIdAsync(int id)
    {
        var building = await _context.Buildings
            .AsNoTracking()
            .Include(b => b.Property)
            .Include(b => b.Units)
            .FirstOrDefaultAsync(b => b.Id == id);

        return building is null ? null : MapToDto(building, building.Property.Name);
    }

    public async Task<List<BuildingDto>?> GetBuildingsByPropertyIdAsync(
        int propertyId,
        bool includeInactive = false,
        IReadOnlyCollection<int>? accessibleBuildingIds = null)
    {
        var propertyExists = await _context.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == propertyId);

        if (!propertyExists)
        {
            return null;
        }

        var query = _context.Buildings
            .AsNoTracking()
            .Include(b => b.Property)
            .Where(b => b.PropertyId == propertyId);

        if (!includeInactive)
        {
            query = query.Where(b => b.IsActive);
        }

        if (accessibleBuildingIds is not null)
        {
            query = query.Where(b => accessibleBuildingIds.Contains(b.Id));
        }

        return await query
            .OrderBy(b => b.Code)
            .Select(b => new BuildingDto
            {
                Id = b.Id,
                PropertyId = b.PropertyId,
                PropertyName = b.Property.Name,
                Name = b.Name,
                Code = b.Code,
                FloorCount = b.FloorCount,
                Description = b.Description,
                IsActive = b.IsActive,
                UnitCount = b.Units.Count,
                CreatedAt = b.CreatedAt,
                UpdatedAt = b.UpdatedAt
            })
            .ToListAsync();
    }

    public async Task<BuildingDto> CreateBuildingAsync(CreateBuildingDto createDto)
    {
        var property = await _context.Properties
            .Include(p => p.PropertyTypeLookup)
            .FirstOrDefaultAsync(p => p.Id == createDto.PropertyId);

        if (property is null)
        {
            throw new KeyNotFoundException($"ID'si {createDto.PropertyId} olan gayrimenkul bulunamadı.");
        }

        if (!property.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir site/apartman altına yeni bina eklenemez.");
        }

        var isSingleApartment = property.PropertyTypeLookup?.Code == "SINGLE_APARTMENT"
            || property.PropertyType == "SINGLE_APARTMENT"
            || property.PropertyType == "Tek Apartman"
            || property.PropertyType == "Apartman";

        if (isSingleApartment)
        {
            var existingBuildingCount = await _context.Buildings.CountAsync(b => b.PropertyId == createDto.PropertyId);
            if (existingBuildingCount > 0)
            {
                throw new InvalidOperationException("Tek apartman (SINGLE_APARTMENT) türündeki bir gayrimenkul altında en fazla bir bina bulunabilir.");
            }
        }

        var normalizedName = createDto.Name.Trim();
        var normalizedCode = NormalizeCode(createDto.Code);

        var isDuplicateCode = await _context.Buildings
            .AnyAsync(b => b.PropertyId == createDto.PropertyId && b.Code == normalizedCode);

        if (isDuplicateCode)
        {
            throw new InvalidOperationException($"Bu gayrimenkul altında '{normalizedCode}' koduna sahip bir bina zaten mevcut.");
        }

        var building = new Building
        {
            PropertyId = createDto.PropertyId,
            Name = normalizedName,
            Code = normalizedCode,
            FloorCount = createDto.FloorCount,
            Description = createDto.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Buildings.Add(building);
        await _context.SaveChangesAsync();

        return MapToDto(building, property.Name);
    }

    public async Task<BuildingDto?> UpdateBuildingAsync(int id, UpdateBuildingDto updateDto)
    {
        var building = await _context.Buildings
            .Include(b => b.Property)
            .Include(b => b.Units)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (building is null)
        {
            return null;
        }

        var targetProperty = await _context.Properties
            .Include(p => p.PropertyTypeLookup)
            .FirstOrDefaultAsync(p => p.Id == updateDto.PropertyId);

        if (targetProperty is null)
        {
            throw new KeyNotFoundException($"ID'si {updateDto.PropertyId} olan gayrimenkul bulunamadı.");
        }

        if (!targetProperty.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir site/apartmana bina taşınamaz veya güncellenemez.");
        }

        if (building.PropertyId != updateDto.PropertyId)
        {
            var hasUnits = await _context.Units.AnyAsync(u => u.BuildingId == id);
            if (hasUnits)
            {
                throw new InvalidOperationException("Bağlı bağımsız bölümleri olan bir bina başka bir gayrimenkule taşınamaz. Önce bağlı bölümleri silin veya taşıyın.");
            }

            var isTargetSingleApartment = targetProperty.PropertyTypeLookup?.Code == "SINGLE_APARTMENT"
                || targetProperty.PropertyType == "SINGLE_APARTMENT"
                || targetProperty.PropertyType == "Tek Apartman"
                || targetProperty.PropertyType == "Apartman";

            if (isTargetSingleApartment)
            {
                var existingCount = await _context.Buildings.CountAsync(b => b.PropertyId == updateDto.PropertyId && b.Id != id);
                if (existingCount > 0)
                {
                    throw new InvalidOperationException("Hedef tek apartman (SINGLE_APARTMENT) mülkü altında zaten bir bina bulunmaktadır.");
                }
            }
        }

        var normalizedName = updateDto.Name.Trim();
        var normalizedCode = NormalizeCode(updateDto.Code);

        var isDuplicateCode = await _context.Buildings
            .AnyAsync(b => b.Id != id && b.PropertyId == updateDto.PropertyId && b.Code == normalizedCode);

        if (isDuplicateCode)
        {
            throw new InvalidOperationException($"Bu gayrimenkul altında '{normalizedCode}' koduna sahip başka bir bina zaten mevcut.");
        }

        building.PropertyId = updateDto.PropertyId;
        building.Name = normalizedName;
        building.Code = normalizedCode;
        building.FloorCount = updateDto.FloorCount;
        building.Description = updateDto.Description?.Trim();
        building.IsActive = updateDto.IsActive;
        building.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToDto(building, targetProperty.Name);
    }

    public async Task<bool> DeleteBuildingAsync(int id)
    {
        var building = await _context.Buildings.FindAsync(id);
        if (building is null)
        {
            return false;
        }

        var hasUnits = await _context.Units.AnyAsync(u => u.BuildingId == id);
        if (hasUnits)
        {
            throw new InvalidOperationException("Bu bina altında bağlı bağımsız bölüm(ler) bulunduğu için silinemez. Önce bağlı bölümleri silin veya kaydı pasifleştirin.");
        }

        _context.Buildings.Remove(building);
        await _context.SaveChangesAsync();

        return true;
    }

    private static string NormalizeCode(string code)
    {
        var trimmed = code.Trim();
        var normalized = Regex.Replace(trimmed, @"[\s-]+", "_");
        return normalized.ToUpperInvariant();
    }

    private static BuildingDto MapToDto(Building building, string propertyName)
    {
        return new BuildingDto
        {
            Id = building.Id,
            PropertyId = building.PropertyId,
            PropertyName = propertyName,
            Name = building.Name,
            Code = building.Code,
            FloorCount = building.FloorCount,
            Description = building.Description,
            IsActive = building.IsActive,
            UnitCount = building.Units.Count,
            CreatedAt = building.CreatedAt,
            UpdatedAt = building.UpdatedAt
        };
    }

    public async Task<BuildingFloorMapDto?> GetBuildingFloorMapAsync(int buildingId)
    {
        var building = await _context.Buildings
            .AsNoTracking()
            .Include(b => b.Property)
            .FirstOrDefaultAsync(b => b.Id == buildingId);

        if (building is null)
        {
            return null;
        }

        var units = await _context.Units
            .AsNoTracking()
            .Include(u => u.UnitType)
            .Where(u => u.BuildingId == buildingId)
            .OrderBy(u => u.FloorNumber)
            .ThenBy(u => u.UnitNumber)
            .ToListAsync();

        var unitIds = units.Select(u => u.Id).ToList();
        var now = DateTime.UtcNow;

        var activeOccupancies = unitIds.Count > 0
            ? await _context.UnitOccupancies
                .AsNoTracking()
                .Include(uo => uo.User)
                .Include(uo => uo.OccupancyType)
                .Where(uo => unitIds.Contains(uo.UnitId) &&
                            uo.IsActive &&
                            (uo.EndDate == null || uo.EndDate > now))
                .ToListAsync()
            : new List<UnitOccupancy>();

        var unitCharges = unitIds.Count > 0
            ? await _context.UnitCharges
                .AsNoTracking()
                .Include(uc => uc.Payments)
                .Where(uc => unitIds.Contains(uc.UnitId) && !uc.IsCancelled)
                .ToListAsync()
            : new List<UnitCharge>();

        var activeMaintenanceRequests = unitIds.Count > 0
            ? await _context.MaintenanceRequests
                .AsNoTracking()
                .Where(mr => unitIds.Contains(mr.UnitId) &&
                            (mr.Status == "OPEN" || mr.Status == "IN_PROGRESS"))
                .ToListAsync()
            : new List<MaintenanceRequest>();

        var occupanciesByUnit = activeOccupancies.GroupBy(o => o.UnitId).ToDictionary(g => g.Key, g => g.ToList());
        var chargesByUnit = unitCharges.GroupBy(c => c.UnitId).ToDictionary(g => g.Key, g => g.ToList());
        var requestsByUnit = activeMaintenanceRequests.GroupBy(r => r.UnitId).ToDictionary(g => g.Key, g => g.ToList());

        var unitDtos = new List<FloorMapUnitDto>();

        foreach (var unit in units)
        {
            var unitOccs = occupanciesByUnit.GetValueOrDefault(unit.Id) ?? new List<UnitOccupancy>();
            var unitChgs = chargesByUnit.GetValueOrDefault(unit.Id) ?? new List<UnitCharge>();
            var unitReqs = requestsByUnit.GetValueOrDefault(unit.Id) ?? new List<MaintenanceRequest>();

            string occStatus = "VACANT";
            string? primaryResidentName = null;
            int activeResidentCount = unitOccs.Count;

            if (activeResidentCount > 0)
            {
                var primaryOcc = unitOccs.FirstOrDefault(o => o.IsPrimary) ?? unitOccs.First();
                primaryResidentName = $"{primaryOcc.User.FirstName} {primaryOcc.User.LastName}".Trim();

                var codeUpper = primaryOcc.OccupancyType.Code.ToUpperInvariant();
                if (codeUpper == "TENANT")
                {
                    occStatus = "OCCUPIED_TENANT";
                }
                else
                {
                    occStatus = "OCCUPIED_OWNER";
                }
            }

            decimal totalOutstanding = 0;
            bool hasOverdue = false;

            foreach (var chg in unitChgs)
            {
                var paid = chg.Payments.Where(p => !p.IsCancelled).Sum(p => p.Amount);
                var remaining = chg.Amount - paid;
                if (remaining > 0)
                {
                    totalOutstanding += remaining;
                    if (chg.DueDate < now)
                    {
                        hasOverdue = true;
                    }
                }
            }

            int openReqCount = unitReqs.Count;
            bool hasEmergency = unitReqs.Any(r => r.Priority == "EMERGENCY");
            string maintStatus = "NONE";

            if (openReqCount > 0)
            {
                if (unitReqs.Any(r => r.Priority == "EMERGENCY"))
                    maintStatus = "EMERGENCY";
                else if (unitReqs.Any(r => r.Priority == "HIGH"))
                    maintStatus = "HIGH";
                else if (unitReqs.Any(r => r.Priority == "NORMAL"))
                    maintStatus = "NORMAL";
                else if (unitReqs.Any(r => r.Priority == "LOW"))
                    maintStatus = "LOW";
                else
                    maintStatus = "NORMAL";
            }

            unitDtos.Add(new FloorMapUnitDto
            {
                UnitId = unit.Id,
                UnitNumber = unit.UnitNumber,
                FloorNumber = unit.FloorNumber,
                UnitTypeName = unit.UnitType.Name,
                IsActive = unit.IsActive,
                OccupancyStatus = occStatus,
                PrimaryResidentName = primaryResidentName,
                ActiveResidentCount = activeResidentCount,
                OutstandingBalance = Math.Max(0, totalOutstanding),
                HasOverdueDebt = hasOverdue,
                OpenMaintenanceRequestCount = openReqCount,
                HasEmergencyMaintenanceRequest = hasEmergency,
                MaintenanceStatus = maintStatus
            });
        }

        var floorGroups = unitDtos
            .GroupBy(u => u.FloorNumber)
            .OrderByDescending(g => g.Key)
            .Select(g =>
            {
                int floorNum = g.Key;
                string label;
                if (floorNum == 0)
                {
                    label = "Zemin Kat";
                }
                else
                {
                    label = $"{floorNum}. Kat";
                }

                return new FloorMapFloorDto
                {
                    FloorNumber = floorNum,
                    FloorLabel = label,
                    UnitCount = g.Count(),
                    Units = g.OrderBy(u => u.UnitNumber, StringComparer.OrdinalIgnoreCase).ToList()
                };
            })
            .ToList();

        return new BuildingFloorMapDto
        {
            BuildingId = building.Id,
            BuildingName = building.Name,
            BuildingCode = building.Code,
            PropertyId = building.PropertyId,
            PropertyName = building.Property.Name,
            TotalFloors = building.FloorCount,
            TotalUnits = unitDtos.Count,
            Floors = floorGroups
        };
    }
}
