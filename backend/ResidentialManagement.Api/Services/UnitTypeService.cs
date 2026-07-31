using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class UnitTypeService : IUnitTypeService
{
    private readonly AppDbContext _context;

    public UnitTypeService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<UnitTypeDto>> GetAllUnitTypesAsync(bool includeInactive = false)
    {
        var query = _context.UnitTypes.AsNoTracking();

        if (!includeInactive)
        {
            query = query.Where(ut => ut.IsActive);
        }

        return await query
            .OrderBy(ut => ut.Id)
            .Select(ut => MapToDto(ut))
            .ToListAsync();
    }

    public async Task<UnitTypeDto?> GetUnitTypeByIdAsync(int id)
    {
        var unitType = await _context.UnitTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(ut => ut.Id == id);

        return unitType is null ? null : MapToDto(unitType);
    }

    public async Task<UnitTypeDto> CreateUnitTypeAsync(CreateUnitTypeDto createDto)
    {
        var normalizedName = createDto.Name.Trim();
        var normalizedCode = NormalizeCode(createDto.Code);

        var isDuplicateName = await _context.UnitTypes
            .AnyAsync(ut => ut.Name.ToLower() == normalizedName.ToLower());

        if (isDuplicateName)
        {
            throw new InvalidOperationException($"'{normalizedName}' adında bir bölüm türü zaten mevcut.");
        }

        var isDuplicateCode = await _context.UnitTypes
            .AnyAsync(ut => ut.Code == normalizedCode);

        if (isDuplicateCode)
        {
            throw new InvalidOperationException($"'{normalizedCode}' koduna sahip bir bölüm türü zaten mevcut.");
        }

        var unitType = new UnitType
        {
            Name = normalizedName,
            Code = normalizedCode,
            Description = createDto.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.UnitTypes.Add(unitType);
        await _context.SaveChangesAsync();

        return MapToDto(unitType);
    }

    public async Task<UnitTypeDto?> UpdateUnitTypeAsync(int id, UpdateUnitTypeDto updateDto)
    {
        var unitType = await _context.UnitTypes.FindAsync(id);
        if (unitType is null)
        {
            return null;
        }

        var normalizedName = updateDto.Name.Trim();
        var normalizedCode = NormalizeCode(updateDto.Code);

        var isDuplicateName = await _context.UnitTypes
            .AnyAsync(ut => ut.Id != id && ut.Name.ToLower() == normalizedName.ToLower());

        if (isDuplicateName)
        {
            throw new InvalidOperationException($"'{normalizedName}' adında başka bir bölüm türü zaten mevcut.");
        }

        var isDuplicateCode = await _context.UnitTypes
            .AnyAsync(ut => ut.Id != id && ut.Code == normalizedCode);

        if (isDuplicateCode)
        {
            throw new InvalidOperationException($"'{normalizedCode}' koduna sahip başka bir bölüm türü zaten mevcut.");
        }

        unitType.Name = normalizedName;
        unitType.Code = normalizedCode;
        unitType.Description = updateDto.Description?.Trim();
        unitType.IsActive = updateDto.IsActive;

        await _context.SaveChangesAsync();

        return MapToDto(unitType);
    }

    public async Task<bool> DeleteUnitTypeAsync(int id)
    {
        var unitType = await _context.UnitTypes.FindAsync(id);
        if (unitType is null)
        {
            return false;
        }

        var isUsed = await _context.Units.AnyAsync(u => u.UnitTypeId == id);
        if (isUsed)
        {
            throw new InvalidOperationException("Bu bağımsız bölüm türü en az bir bağımsız bölüm tarafından kullanıldığı için silinemez. Önce bağlı bölümleri silin veya pasifleştirin.");
        }

        _context.UnitTypes.Remove(unitType);
        await _context.SaveChangesAsync();

        return true;
    }

    private static string NormalizeCode(string code)
    {
        var trimmed = code.Trim();
        var normalized = Regex.Replace(trimmed, @"[\s-]+", "_");
        return normalized.ToUpperInvariant();
    }

    private static UnitTypeDto MapToDto(UnitType unitType)
    {
        return new UnitTypeDto
        {
            Id = unitType.Id,
            Name = unitType.Name,
            Code = unitType.Code,
            Description = unitType.Description,
            IsActive = unitType.IsActive,
            CreatedAt = unitType.CreatedAt
        };
    }
}
