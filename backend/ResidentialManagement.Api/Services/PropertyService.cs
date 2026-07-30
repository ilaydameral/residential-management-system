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
        var query = _context.Properties.AsNoTracking();

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
            .FirstOrDefaultAsync(p => p.Id == id);

        return property is null ? null : MapToDto(property);
    }

    public async Task<PropertyDto> CreatePropertyAsync(CreatePropertyDto createDto)
    {
        var property = new Property
        {
            Name = createDto.Name,
            PropertyType = createDto.PropertyType,
            AddressLine = createDto.AddressLine,
            City = createDto.City,
            District = createDto.District,
            Description = createDto.Description,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Properties.Add(property);
        await _context.SaveChangesAsync();

        return MapToDto(property);
    }

    public async Task<PropertyDto?> UpdatePropertyAsync(int id, UpdatePropertyDto updateDto)
    {
        var property = await _context.Properties.FindAsync(id);
        if (property is null)
        {
            return null;
        }

        property.Name = updateDto.Name;
        property.PropertyType = updateDto.PropertyType;
        property.AddressLine = updateDto.AddressLine;
        property.City = updateDto.City;
        property.District = updateDto.District;
        property.Description = updateDto.Description;
        property.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

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

    private static PropertyDto MapToDto(Property property)
    {
        return new PropertyDto
        {
            Id = property.Id,
            Name = property.Name,
            PropertyType = property.PropertyType,
            AddressLine = property.AddressLine,
            City = property.City,
            District = property.District,
            Description = property.Description,
            IsActive = property.IsActive,
            CreatedAt = property.CreatedAt
        };
    }
}
