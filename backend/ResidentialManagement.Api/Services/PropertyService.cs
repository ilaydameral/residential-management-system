using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class PropertyService : IPropertyService
{
    private readonly AppDbContext _context;

    public PropertyService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PropertyDto>> GetAllPropertiesAsync(bool includeInactive = false)
    {
        var query = _context.Properties
            .AsNoTracking()
            .Include(p => p.PropertyTypeLookup)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(p => p.IsActive);
        }

        return await query
            .OrderBy(p => p.Id)
            .Select(p => MapToDto(p))
            .ToListAsync();
    }

    public async Task<PropertyDto?> GetPropertyByIdAsync(int id)
    {
        var property = await _context.Properties
            .AsNoTracking()
            .Include(p => p.PropertyTypeLookup)
            .FirstOrDefaultAsync(p => p.Id == id);

        return property is null ? null : MapToDto(property);
    }

    public async Task<PropertyDto> CreatePropertyAsync(CreatePropertyDto createDto)
    {
        var (propertyTypeId, propertyTypeCode, propertyTypeName) = await ResolvePropertyTypeAsync(createDto.PropertyTypeId, createDto.PropertyType);

        var property = new Property
        {
            Name = createDto.Name.Trim(),
            PropertyTypeId = propertyTypeId,
            PropertyType = propertyTypeCode,
            AddressLine = createDto.AddressLine.Trim(),
            City = createDto.City.Trim(),
            District = createDto.District.Trim(),
            Description = createDto.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Properties.Add(property);
        await _context.SaveChangesAsync();

        if (propertyTypeId.HasValue)
        {
            property.PropertyTypeLookup = await _context.PropertyTypes.FindAsync(propertyTypeId.Value);
        }

        return MapToDto(property);
    }

    public async Task<PropertyDto?> UpdatePropertyAsync(int id, UpdatePropertyDto updateDto)
    {
        var property = await _context.Properties
            .Include(p => p.PropertyTypeLookup)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (property is null)
        {
            return null;
        }

        var (propertyTypeId, propertyTypeCode, propertyTypeName) = await ResolvePropertyTypeAsync(updateDto.PropertyTypeId, updateDto.PropertyType);

        property.Name = updateDto.Name.Trim();
        property.PropertyTypeId = propertyTypeId;
        property.PropertyType = propertyTypeCode;
        property.AddressLine = updateDto.AddressLine.Trim();
        property.City = updateDto.City.Trim();
        property.District = updateDto.District.Trim();
        property.Description = updateDto.Description?.Trim();
        property.IsActive = updateDto.IsActive;
        property.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        if (propertyTypeId.HasValue)
        {
            property.PropertyTypeLookup = await _context.PropertyTypes.FindAsync(propertyTypeId.Value);
        }

        return MapToDto(property);
    }

    public async Task<bool> DeactivatePropertyAsync(int id)
    {
        var property = await _context.Properties.FindAsync(id);
        if (property is null)
        {
            return false;
        }

        property.IsActive = false;
        property.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<(int? id, string code, string name)> ResolvePropertyTypeAsync(int? propertyTypeId, string? propertyTypeName)
    {
        if (propertyTypeId.HasValue)
        {
            var lookup = await _context.PropertyTypes.FindAsync(propertyTypeId.Value);
            if (lookup is null)
            {
                throw new KeyNotFoundException($"ID'si {propertyTypeId.Value} olan gayrimenkul türü bulunamadı.");
            }

            if (!lookup.IsActive)
            {
                throw new InvalidOperationException("Pasif durumdaki bir gayrimenkul türü seçilemez.");
            }

            return (lookup.Id, lookup.Code, lookup.Name);
        }

        if (!string.IsNullOrWhiteSpace(propertyTypeName))
        {
            var trimmed = propertyTypeName.Trim();
            var lookup = await _context.PropertyTypes.FirstOrDefaultAsync(pt => pt.Name == trimmed || pt.Code == trimmed);
            if (lookup is not null)
            {
                if (!lookup.IsActive)
                {
                    throw new InvalidOperationException("Pasif durumdaki bir gayrimenkul türü seçilemez.");
                }
                return (lookup.Id, lookup.Code, lookup.Name);
            }

            return (null, trimmed, trimmed);
        }

        throw new InvalidOperationException("Gayrimenkul türü gereklidir.");
    }

    private static PropertyDto MapToDto(Property property)
    {
        var displayName = property.PropertyTypeLookup?.Name ?? property.PropertyType;

        return new PropertyDto
        {
            Id = property.Id,
            Name = property.Name,
            PropertyTypeId = property.PropertyTypeId,
            PropertyType = property.PropertyType,
            PropertyTypeName = displayName,
            AddressLine = property.AddressLine,
            City = property.City,
            District = property.District,
            Description = property.Description,
            IsActive = property.IsActive,
            CreatedAt = property.CreatedAt
        };
    }
}
