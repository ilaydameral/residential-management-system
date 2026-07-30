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

    public async Task<List<BuildingDto>> GetAllBuildingsAsync(bool includeInactive = false)
    {
        var query = _context.Buildings
            .AsNoTracking()
            .Include(b => b.Property)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(b => b.IsActive);
        }

        return await query
            .OrderBy(b => b.PropertyId)
            .ThenBy(b => b.Code)
            .Select(b => MapToDto(b, b.Property.Name))
            .ToListAsync();
    }

    public async Task<BuildingDto?> GetBuildingByIdAsync(int id)
    {
        var building = await _context.Buildings
            .AsNoTracking()
            .Include(b => b.Property)
            .FirstOrDefaultAsync(b => b.Id == id);

        return building is null ? null : MapToDto(building, building.Property.Name);
    }

    public async Task<List<BuildingDto>?> GetBuildingsByPropertyIdAsync(int propertyId, bool includeInactive = false)
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

        return await query
            .OrderBy(b => b.Code)
            .Select(b => MapToDto(b, b.Property.Name))
            .ToListAsync();
    }

    public async Task<BuildingDto> CreateBuildingAsync(CreateBuildingDto createDto)
    {
        var property = await _context.Properties.FindAsync(createDto.PropertyId);
        if (property is null)
        {
            throw new KeyNotFoundException($"ID'si {createDto.PropertyId} olan gayrimenkul bulunamadı.");
        }

        if (!property.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir site/apartman altına yeni bina eklenemez.");
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
            .FirstOrDefaultAsync(b => b.Id == id);

        if (building is null)
        {
            return null;
        }

        var targetProperty = await _context.Properties.FindAsync(updateDto.PropertyId);
        if (targetProperty is null)
        {
            throw new KeyNotFoundException($"ID'si {updateDto.PropertyId} olan gayrimenkul bulunamadı.");
        }

        if (!targetProperty.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir site/apartmana bina taşınamaz veya güncellenemez.");
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
            CreatedAt = building.CreatedAt,
            UpdatedAt = building.UpdatedAt
        };
    }
}
