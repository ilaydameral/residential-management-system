using System.Data;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class UnitOccupancyService : IUnitOccupancyService
{
    private readonly AppDbContext _context;

    public UnitOccupancyService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<UnitOccupancyDto>?> GetByUnitIdAsync(int unitId, bool includeInactive = false)
    {
        var unitExists = await _context.Units
            .AsNoTracking()
            .AnyAsync(u => u.Id == unitId);

        if (!unitExists)
        {
            return null;
        }

        var utcNow = DateTime.UtcNow;
        var query = OccupanciesWithDetails()
            .AsNoTracking()
            .Where(uo => uo.UnitId == unitId);

        if (!includeInactive)
        {
            query = query.Where(uo =>
                uo.IsActive &&
                (!uo.EndDate.HasValue || uo.EndDate.Value >= utcNow));
        }

        var occupancies = await query
            .OrderByDescending(uo => uo.IsPrimary)
            .ThenByDescending(uo => uo.StartDate)
            .ToListAsync();

        return occupancies.Select(MapToDto).ToList();
    }

    public async Task<UnitOccupancyDto?> GetByIdAsync(int id)
    {
        var occupancy = await OccupanciesWithDetails()
            .AsNoTracking()
            .FirstOrDefaultAsync(uo => uo.Id == id);

        return occupancy is null ? null : MapToDto(occupancy);
    }

    public async Task<UnitOccupancyDto> CreateAsync(int unitId, CreateUnitOccupancyDto createDto)
    {
        var startDate = NormalizeUtc(createDto.StartDate);
        DateTime? endDate = createDto.EndDate.HasValue
            ? NormalizeUtc(createDto.EndDate.Value)
            : null;

        EnsureValidDateRange(startDate, endDate);

        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == createDto.UserId);

        if (user is null)
        {
            throw new KeyNotFoundException($"ID'si {createDto.UserId} olan kullanıcı bulunamadı.");
        }

        if (!user.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir kullanıcıya ikamet ilişkisi atanamaz.");
        }

        var unit = await _context.Units
            .Include(u => u.Building)
                .ThenInclude(b => b.Property)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit is null)
        {
            throw new KeyNotFoundException($"ID'si {unitId} olan bölüm bulunamadı.");
        }

        EnsureActiveUnitHierarchy(unit);

        var occupancyType = await _context.OccupancyTypes
            .FirstOrDefaultAsync(ot => ot.Id == createDto.OccupancyTypeId);

        if (occupancyType is null)
        {
            throw new KeyNotFoundException($"ID'si {createDto.OccupancyTypeId} olan ikamet türü bulunamadı.");
        }

        if (!occupancyType.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir ikamet türü kullanılamaz.");
        }

        await EnsureNoDateOverlapAsync(
            createDto.UserId,
            unitId,
            createDto.OccupancyTypeId,
            startDate,
            endDate
        );

        var utcNow = DateTime.UtcNow;
        var isActive = !endDate.HasValue || endDate.Value >= utcNow;

        if (createDto.IsPrimary && isActive)
        {
            await EnsureNoActivePrimaryAsync(unitId);
        }

        var occupancy = new UnitOccupancy
        {
            UserId = createDto.UserId,
            UnitId = unitId,
            OccupancyTypeId = createDto.OccupancyTypeId,
            StartDate = startDate,
            EndDate = endDate,
            IsActive = isActive,
            IsPrimary = createDto.IsPrimary,
            Notes = createDto.Notes?.Trim(),
            CreatedAt = utcNow,
            User = user,
            Unit = unit,
            OccupancyType = occupancyType
        };

        _context.UnitOccupancies.Add(occupancy);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return MapToDto(occupancy);
    }

    public async Task<UnitOccupancyDto?> UpdateAsync(int id, UpdateUnitOccupancyDto updateDto)
    {
        var startDate = NormalizeUtc(updateDto.StartDate);
        DateTime? endDate = updateDto.EndDate.HasValue
            ? NormalizeUtc(updateDto.EndDate.Value)
            : null;

        EnsureValidDateRange(startDate, endDate);

        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var occupancy = await OccupanciesWithDetails()
            .FirstOrDefaultAsync(uo => uo.Id == id);

        if (occupancy is null)
        {
            return null;
        }

        if (!occupancy.User.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir kullanıcıya ait ikamet ilişkisi güncellenemez.");
        }

        EnsureActiveUnitHierarchy(occupancy.Unit);

        var occupancyType = await _context.OccupancyTypes
            .FirstOrDefaultAsync(ot => ot.Id == updateDto.OccupancyTypeId);

        if (occupancyType is null)
        {
            throw new KeyNotFoundException($"ID'si {updateDto.OccupancyTypeId} olan ikamet türü bulunamadı.");
        }

        if (!occupancyType.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir ikamet türü kullanılamaz.");
        }

        if (!occupancy.IsActive && !endDate.HasValue)
        {
            throw new InvalidOperationException("Sonlandırılmış bir ikamet ilişkisi güncelleme yoluyla yeniden etkinleştirilemez. Yeni bir kayıt oluşturun.");
        }

        await EnsureNoDateOverlapAsync(
            occupancy.UserId,
            occupancy.UnitId,
            updateDto.OccupancyTypeId,
            startDate,
            endDate,
            occupancy.Id
        );

        var utcNow = DateTime.UtcNow;
        var remainsActive = occupancy.IsActive &&
            (!endDate.HasValue || endDate.Value >= utcNow);

        if (updateDto.IsPrimary && remainsActive)
        {
            await EnsureNoActivePrimaryAsync(occupancy.UnitId, occupancy.Id);
        }

        occupancy.OccupancyTypeId = updateDto.OccupancyTypeId;
        occupancy.OccupancyType = occupancyType;
        occupancy.StartDate = startDate;
        occupancy.EndDate = endDate;
        occupancy.IsActive = remainsActive;
        occupancy.IsPrimary = updateDto.IsPrimary;
        occupancy.Notes = updateDto.Notes?.Trim();
        occupancy.UpdatedAt = utcNow;

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return MapToDto(occupancy);
    }

    public async Task<UnitOccupancyDto?> EndAsync(int id, EndUnitOccupancyDto endDto)
    {
        var occupancy = await OccupanciesWithDetails()
            .FirstOrDefaultAsync(uo => uo.Id == id);

        if (occupancy is null)
        {
            return null;
        }

        var utcNow = DateTime.UtcNow;
        if (!occupancy.IsActive ||
            (occupancy.EndDate.HasValue && occupancy.EndDate.Value < utcNow))
        {
            throw new InvalidOperationException("Bu ikamet ilişkisi zaten sonlandırılmıştır.");
        }

        var endDate = NormalizeUtc(endDto.EndDate);
        if (endDate < occupancy.StartDate)
        {
            throw new BadRequestException("Bitiş tarihi başlangıç tarihinden önce olamaz.");
        }

        occupancy.EndDate = endDate;
        occupancy.IsActive = false;
        occupancy.UpdatedAt = utcNow;

        await _context.SaveChangesAsync();

        return MapToDto(occupancy);
    }

    private IQueryable<UnitOccupancy> OccupanciesWithDetails()
    {
        return _context.UnitOccupancies
            .Include(uo => uo.User)
            .Include(uo => uo.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(uo => uo.OccupancyType);
    }

    private async Task EnsureNoDateOverlapAsync(
        int userId,
        int unitId,
        int occupancyTypeId,
        DateTime startDate,
        DateTime? endDate,
        int? excludedId = null)
    {
        var requestedEndDate = endDate ?? DateTime.MaxValue;

        var hasOverlap = await _context.UnitOccupancies.AnyAsync(uo =>
            (!excludedId.HasValue || uo.Id != excludedId.Value) &&
            uo.UserId == userId &&
            uo.UnitId == unitId &&
            uo.OccupancyTypeId == occupancyTypeId &&
            uo.StartDate <= requestedEndDate &&
            (!uo.EndDate.HasValue || uo.EndDate.Value >= startDate));

        if (hasOverlap)
        {
            throw new InvalidOperationException("Aynı kullanıcı, bölüm ve ikamet türü için çakışan bir tarih aralığı zaten mevcut.");
        }
    }

    private async Task EnsureNoActivePrimaryAsync(int unitId, int? excludedId = null)
    {
        var utcNow = DateTime.UtcNow;
        var hasActivePrimary = await _context.UnitOccupancies.AnyAsync(uo =>
            (!excludedId.HasValue || uo.Id != excludedId.Value) &&
            uo.UnitId == unitId &&
            uo.IsPrimary &&
            uo.IsActive &&
            (!uo.EndDate.HasValue || uo.EndDate.Value >= utcNow));

        if (hasActivePrimary)
        {
            throw new InvalidOperationException("Bu bölüm için zaten aktif bir birincil ikamet kaydı bulunmaktadır.");
        }
    }

    private static void EnsureActiveUnitHierarchy(Unit unit)
    {
        if (!unit.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir bölüme ikamet ilişkisi atanamaz veya güncellenemez.");
        }

        if (!unit.Building.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir binaya ait ikamet ilişkisi oluşturulamaz veya güncellenemez.");
        }

        if (!unit.Building.Property.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir gayrimenkule ait ikamet ilişkisi oluşturulamaz veya güncellenemez.");
        }
    }

    private static void EnsureValidDateRange(DateTime startDate, DateTime? endDate)
    {
        if (startDate == default)
        {
            throw new BadRequestException("Başlangıç tarihi zorunludur.");
        }

        if (endDate.HasValue && endDate.Value < startDate)
        {
            throw new BadRequestException("Bitiş tarihi başlangıç tarihinden önce olamaz.");
        }
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }

    private static UnitOccupancyDto MapToDto(UnitOccupancy occupancy)
    {
        return new UnitOccupancyDto
        {
            Id = occupancy.Id,
            UserId = occupancy.UserId,
            UserName = occupancy.User.UserName,
            UserFullName = $"{occupancy.User.FirstName} {occupancy.User.LastName}".Trim(),
            UserEmail = occupancy.User.Email,
            UnitId = occupancy.UnitId,
            UnitNumber = occupancy.Unit.UnitNumber,
            BuildingId = occupancy.Unit.BuildingId,
            BuildingName = occupancy.Unit.Building.Name,
            PropertyId = occupancy.Unit.Building.PropertyId,
            PropertyName = occupancy.Unit.Building.Property.Name,
            OccupancyTypeId = occupancy.OccupancyTypeId,
            OccupancyTypeCode = occupancy.OccupancyType.Code,
            OccupancyTypeName = occupancy.OccupancyType.Name,
            StartDate = occupancy.StartDate,
            EndDate = occupancy.EndDate,
            IsActive = occupancy.IsActive,
            IsPrimary = occupancy.IsPrimary,
            Notes = occupancy.Notes,
            CreatedAt = occupancy.CreatedAt,
            UpdatedAt = occupancy.UpdatedAt
        };
    }
}
