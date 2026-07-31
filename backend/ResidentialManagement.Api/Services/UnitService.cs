using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class UnitService : IUnitService
{
    private readonly AppDbContext _context;

    public UnitService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<UnitDto>> GetAllUnitsAsync(
        bool includeInactive = false,
        int? residentUserId = null)
    {
        var query = _context.Units
            .AsNoTracking()
            .Include(u => u.Building)
                .ThenInclude(b => b.Property)
            .Include(u => u.UnitType)
            .AsQueryable();

        query = ApplyReadAccessFilter(query, includeInactive, residentUserId);

        return await query
            .OrderBy(u => u.Building.PropertyId)
            .ThenBy(u => u.BuildingId)
            .ThenBy(u => u.UnitNumber)
            .Select(u => MapToDto(u))
            .ToListAsync();
    }

    public async Task<UnitDto?> GetUnitByIdAsync(int id, int? residentUserId = null)
    {
        var query = _context.Units
            .AsNoTracking()
            .Include(u => u.Building)
                .ThenInclude(b => b.Property)
            .Include(u => u.UnitType)
            .AsQueryable();

        query = ApplyReadAccessFilter(
            query,
            includeInactive: true,
            residentUserId: residentUserId
        );

        var unit = await query.FirstOrDefaultAsync(u => u.Id == id);

        return unit is null ? null : MapToDto(unit);
    }

    public async Task<List<UnitDto>?> GetUnitsByBuildingIdAsync(
        int buildingId,
        bool includeInactive = false,
        int? residentUserId = null)
    {
        var buildingExists = await _context.Buildings
            .AsNoTracking()
            .AnyAsync(b => b.Id == buildingId);

        if (!buildingExists)
        {
            return null;
        }

        var query = _context.Units
            .AsNoTracking()
            .Include(u => u.Building)
                .ThenInclude(b => b.Property)
            .Include(u => u.UnitType)
            .Where(u => u.BuildingId == buildingId);

        query = ApplyReadAccessFilter(query, includeInactive, residentUserId);

        return await query
            .OrderBy(u => u.UnitNumber)
            .Select(u => MapToDto(u))
            .ToListAsync();
    }

    public async Task<List<UnitDto>?> GetUnitsByPropertyIdAsync(
        int propertyId,
        bool includeInactive = false,
        int? residentUserId = null)
    {
        var propertyExists = await _context.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == propertyId);

        if (!propertyExists)
        {
            return null;
        }

        var query = _context.Units
            .AsNoTracking()
            .Include(u => u.Building)
                .ThenInclude(b => b.Property)
            .Include(u => u.UnitType)
            .Where(u => u.Building.PropertyId == propertyId);

        query = ApplyReadAccessFilter(query, includeInactive, residentUserId);

        return await query
            .OrderBy(u => u.Building.Code)
            .ThenBy(u => u.UnitNumber)
            .Select(u => MapToDto(u))
            .ToListAsync();
    }

    public async Task<UnitDto> CreateUnitAsync(CreateUnitDto createDto)
    {
        var building = await _context.Buildings
            .Include(b => b.Property)
            .FirstOrDefaultAsync(b => b.Id == createDto.BuildingId);

        if (building is null)
        {
            throw new KeyNotFoundException($"ID'si {createDto.BuildingId} olan bina bulunamadı.");
        }

        if (!building.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir bina altına yeni bölüm eklenemez.");
        }

        if (!building.Property.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir gayrimenkul altına yeni bölüm eklenemez.");
        }

        if (createDto.FloorNumber > building.FloorCount)
        {
            throw new InvalidOperationException($"Kat numarası ({createDto.FloorNumber}), binanın toplam kat sayısından ({building.FloorCount}) büyük olamaz.");
        }

        var unitType = await _context.UnitTypes.FindAsync(createDto.UnitTypeId);
        if (unitType is null)
        {
            throw new KeyNotFoundException($"ID'si {createDto.UnitTypeId} olan bölüm türü bulunamadı.");
        }

        if (!unitType.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir bölüm türü ile yeni bölüm eklenemez.");
        }

        if (createDto.GrossArea.HasValue && createDto.NetArea.HasValue && createDto.NetArea.Value > createDto.GrossArea.Value)
        {
            throw new InvalidOperationException("Net alan brüt alandan büyük olamaz.");
        }

        var trimmedUnitNumber = createDto.UnitNumber.Trim();

        var isDuplicateNumber = await _context.Units
            .AnyAsync(u => u.BuildingId == createDto.BuildingId && u.UnitNumber == trimmedUnitNumber);

        if (isDuplicateNumber)
        {
            throw new InvalidOperationException($"Bu bina altında '{trimmedUnitNumber}' numaralı bölüm zaten mevcut.");
        }

        var unit = new Unit
        {
            BuildingId = createDto.BuildingId,
            UnitTypeId = createDto.UnitTypeId,
            UnitNumber = trimmedUnitNumber,
            FloorNumber = createDto.FloorNumber,
            GrossArea = createDto.GrossArea,
            NetArea = createDto.NetArea,
            Description = createDto.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Units.Add(unit);
        await _context.SaveChangesAsync();

        unit.Building = building;
        unit.UnitType = unitType;

        return MapToDto(unit);
    }

    public async Task<UnitDto?> UpdateUnitAsync(int id, UpdateUnitDto updateDto)
    {
        var unit = await _context.Units
            .Include(u => u.Building)
                .ThenInclude(b => b.Property)
            .Include(u => u.UnitType)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (unit is null)
        {
            return null;
        }

        var targetBuilding = await _context.Buildings
            .Include(b => b.Property)
            .FirstOrDefaultAsync(b => b.Id == updateDto.BuildingId);

        if (targetBuilding is null)
        {
            throw new KeyNotFoundException($"ID'si {updateDto.BuildingId} olan bina bulunamadı.");
        }

        if (!targetBuilding.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir binaya bölüm taşınamaz veya güncellenemez.");
        }

        if (!targetBuilding.Property.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir gayrimenkule ait binaya bölüm taşınamaz veya güncellenemez.");
        }

        if (updateDto.FloorNumber > targetBuilding.FloorCount)
        {
            throw new InvalidOperationException($"Kat numarası ({updateDto.FloorNumber}), binanın toplam kat sayısından ({targetBuilding.FloorCount}) büyük olamaz.");
        }

        var targetUnitType = await _context.UnitTypes.FindAsync(updateDto.UnitTypeId);
        if (targetUnitType is null)
        {
            throw new KeyNotFoundException($"ID'si {updateDto.UnitTypeId} olan bölüm türü bulunamadı.");
        }

        if (!targetUnitType.IsActive && unit.UnitTypeId != updateDto.UnitTypeId)
        {
            throw new InvalidOperationException("Pasif durumdaki bir bölüm türüne güncelleme yapılamaz.");
        }

        if (updateDto.GrossArea.HasValue && updateDto.NetArea.HasValue && updateDto.NetArea.Value > updateDto.GrossArea.Value)
        {
            throw new InvalidOperationException("Net alan brüt alandan büyük olamaz.");
        }

        var trimmedUnitNumber = updateDto.UnitNumber.Trim();

        var isDuplicateNumber = await _context.Units
            .AnyAsync(u => u.Id != id && u.BuildingId == updateDto.BuildingId && u.UnitNumber == trimmedUnitNumber);

        if (isDuplicateNumber)
        {
            throw new InvalidOperationException($"Bu bina altında '{trimmedUnitNumber}' numaralı başka bir bölüm zaten mevcut.");
        }

        unit.BuildingId = updateDto.BuildingId;
        unit.UnitTypeId = updateDto.UnitTypeId;
        unit.UnitNumber = trimmedUnitNumber;
        unit.FloorNumber = updateDto.FloorNumber;
        unit.GrossArea = updateDto.GrossArea;
        unit.NetArea = updateDto.NetArea;
        unit.Description = updateDto.Description?.Trim();
        unit.IsActive = updateDto.IsActive;
        unit.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        unit.Building = targetBuilding;
        unit.UnitType = targetUnitType;

        return MapToDto(unit);
    }

    public async Task<bool> DeleteUnitAsync(int id)
    {
        var unit = await _context.Units.FindAsync(id);
        if (unit is null)
        {
            return false;
        }

        _context.Units.Remove(unit);
        await _context.SaveChangesAsync();

        return true;
    }

    private static IQueryable<Unit> ApplyReadAccessFilter(
        IQueryable<Unit> query,
        bool includeInactive,
        int? residentUserId)
    {
        if (residentUserId.HasValue)
        {
            var utcNow = DateTime.UtcNow;
            return query.Where(u =>
                u.IsActive &&
                u.Building.IsActive &&
                u.Building.Property.IsActive &&
                u.UnitOccupancies.Any(uo =>
                    uo.UserId == residentUserId.Value &&
                    uo.IsActive &&
                    uo.StartDate <= utcNow &&
                    (!uo.EndDate.HasValue || uo.EndDate.Value >= utcNow)));
        }

        return includeInactive ? query : query.Where(u => u.IsActive);
    }

    private static UnitDto MapToDto(Unit unit)
    {
        return new UnitDto
        {
            Id = unit.Id,
            BuildingId = unit.BuildingId,
            BuildingName = unit.Building?.Name ?? string.Empty,
            PropertyId = unit.Building?.PropertyId ?? 0,
            PropertyName = unit.Building?.Property?.Name ?? string.Empty,
            UnitTypeId = unit.UnitTypeId,
            UnitTypeName = unit.UnitType?.Name ?? string.Empty,
            UnitTypeCode = unit.UnitType?.Code ?? string.Empty,
            UnitNumber = unit.UnitNumber,
            FloorNumber = unit.FloorNumber,
            GrossArea = unit.GrossArea,
            NetArea = unit.NetArea,
            Description = unit.Description,
            IsActive = unit.IsActive,
            CreatedAt = unit.CreatedAt,
            UpdatedAt = unit.UpdatedAt
        };
    }
}
