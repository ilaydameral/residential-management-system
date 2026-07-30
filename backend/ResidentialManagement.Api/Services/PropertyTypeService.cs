using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class PropertyTypeService : IPropertyTypeService
{
    private readonly AppDbContext _context;

    public PropertyTypeService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PropertyTypeDto>> GetAllPropertyTypesAsync(bool includeInactive = false)
    {
        var query = _context.PropertyTypes.AsNoTracking();

        if (!includeInactive)
        {
            query = query.Where(pt => pt.IsActive);
        }

        return await query
            .OrderBy(pt => pt.Id)
            .Select(pt => MapToDto(pt))
            .ToListAsync();
    }

    public async Task<PropertyTypeDto?> GetPropertyTypeByIdAsync(int id)
    {
        var propertyType = await _context.PropertyTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(pt => pt.Id == id);

        return propertyType is null ? null : MapToDto(propertyType);
    }

    public async Task<PropertyTypeDto> CreatePropertyTypeAsync(CreatePropertyTypeDto createDto)
    {
        var normalizedName = createDto.Name.Trim();
        var normalizedCode = NormalizeCode(createDto.Code);

        var isDuplicateName = await _context.PropertyTypes
            .AnyAsync(pt => pt.Name.ToLower() == normalizedName.ToLower());

        if (isDuplicateName)
        {
            throw new InvalidOperationException($"'{normalizedName}' adında bir gayrimenkul türü zaten mevcut.");
        }

        var isDuplicateCode = await _context.PropertyTypes
            .AnyAsync(pt => pt.Code == normalizedCode);

        if (isDuplicateCode)
        {
            throw new InvalidOperationException($"'{normalizedCode}' koduna sahip bir gayrimenkul türü zaten mevcut.");
        }

        var propertyType = new PropertyType
        {
            Name = normalizedName,
            Code = normalizedCode,
            Description = createDto.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.PropertyTypes.Add(propertyType);
        await _context.SaveChangesAsync();

        return MapToDto(propertyType);
    }

    public async Task<PropertyTypeDto?> UpdatePropertyTypeAsync(int id, UpdatePropertyTypeDto updateDto)
    {
        var propertyType = await _context.PropertyTypes.FindAsync(id);
        if (propertyType is null)
        {
            return null;
        }

        var normalizedName = updateDto.Name.Trim();
        var normalizedCode = NormalizeCode(updateDto.Code);

        var isDuplicateName = await _context.PropertyTypes
            .AnyAsync(pt => pt.Id != id && pt.Name.ToLower() == normalizedName.ToLower());

        if (isDuplicateName)
        {
            throw new InvalidOperationException($"'{normalizedName}' adında başka bir gayrimenkul türü zaten mevcut.");
        }

        var isDuplicateCode = await _context.PropertyTypes
            .AnyAsync(pt => pt.Id != id && pt.Code == normalizedCode);

        if (isDuplicateCode)
        {
            throw new InvalidOperationException($"'{normalizedCode}' koduna sahip başka bir gayrimenkul türü zaten mevcut.");
        }

        propertyType.Name = normalizedName;
        propertyType.Code = normalizedCode;
        propertyType.Description = updateDto.Description?.Trim();
        propertyType.IsActive = updateDto.IsActive;

        await _context.SaveChangesAsync();

        return MapToDto(propertyType);
    }

    public async Task<bool> DeletePropertyTypeAsync(int id)
    {
        var propertyType = await _context.PropertyTypes.FindAsync(id);
        if (propertyType is null)
        {
            return false;
        }

        var isUsedByProperty = await _context.Properties
            .AnyAsync(p => p.PropertyTypeId == id);

        if (isUsedByProperty)
        {
            throw new InvalidOperationException($"ID'si {id} olan gayrimenkul türü en az bir site/apartman kaydı tarafından kullanıldığı için silinemez.");
        }

        _context.PropertyTypes.Remove(propertyType);
        await _context.SaveChangesAsync();

        return true;
    }

    private static string NormalizeCode(string code)
    {
        var trimmed = code.Trim();
        var normalized = Regex.Replace(trimmed, @"[\s-]+", "_");
        return normalized.ToUpperInvariant();
    }

    private static PropertyTypeDto MapToDto(PropertyType propertyType)
    {
        return new PropertyTypeDto
        {
            Id = propertyType.Id,
            Name = propertyType.Name,
            Code = propertyType.Code,
            Description = propertyType.Description,
            IsActive = propertyType.IsActive,
            CreatedAt = propertyType.CreatedAt
        };
    }
}
