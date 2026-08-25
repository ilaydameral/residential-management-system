using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class ResidentVehicleService : IResidentVehicleService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _scopeService;

    public ResidentVehicleService(AppDbContext context, IManagerScopeService scopeService)
    {
        _context = context;
        _scopeService = scopeService;
    }

    public async Task<ResidentVehicleDto> CreateVehicleAsync(int residentUserId, CreateResidentVehicleDto dto)
    {
        var now = DateTime.UtcNow;

        // Active Occupancy Rule: Resident may register vehicle ONLY for active occupied unit
        var hasActiveOccupancy = await _context.UnitOccupancies
            .AsNoTracking()
            .AnyAsync(uo => uo.UserId == residentUserId
                            && uo.UnitId == dto.UnitId
                            && uo.IsActive
                            && uo.StartDate <= now
                            && (uo.EndDate == null || uo.EndDate > now));

        if (!hasActiveOccupancy)
        {
            throw new InvalidOperationException("Sadece aktif sakini olduğunuz daire için araç kaydı oluşturabilirsiniz.");
        }

        var normalizedPlate = NormalizePlate(dto.PlateNumber);
        if (string.IsNullOrWhiteSpace(normalizedPlate))
        {
            throw new ArgumentException("Araç plakası gereklidir.");
        }

        // Filtered unique check: One active vehicle record per unique normalized plate
        var isPlateActive = await _context.ResidentVehicles
            .AnyAsync(v => v.PlateNumber == normalizedPlate && v.IsActive);

        if (isPlateActive)
        {
            throw new InvalidOperationException($"'{normalizedPlate}' plakalı aktif bir araç kaydı sistemde zaten bulunmaktadır.");
        }

        var normalizedVehicleType = dto.VehicleType?.ToUpperInvariant() ?? "CAR";
        var allowedTypes = new[] { "CAR", "MOTORCYCLE", "ELECTRIC_VEHICLE", "SUV", "OTHER" };
        if (!allowedTypes.Contains(normalizedVehicleType))
        {
            normalizedVehicleType = "CAR";
        }

        var vehicle = new ResidentVehicle
        {
            ResidentUserId = residentUserId,
            UnitId = dto.UnitId,
            PlateNumber = normalizedPlate,
            VehicleType = normalizedVehicleType,
            BrandModel = dto.BrandModel?.Trim(),
            Color = dto.Color?.Trim(),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
        };

        _context.ResidentVehicles.Add(vehicle);
        await _context.SaveChangesAsync();

        return await GetVehicleDtoByIdAsync(vehicle.Id);
    }

    public async Task<List<ResidentVehicleDto>> GetResidentVehiclesAsync(int residentUserId)
    {
        var vehicles = await _context.ResidentVehicles
            .AsNoTracking()
            .Include(v => v.ResidentUser)
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Where(v => v.ResidentUserId == residentUserId)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync();

        return vehicles.Select(ToDto).ToList();
    }

    public async Task<ResidentVehicleDto> UpdateResidentVehicleAsync(int residentUserId, long vehicleId, UpdateResidentVehicleDto dto)
    {
        var vehicle = await _context.ResidentVehicles
            .FirstOrDefaultAsync(v => v.Id == vehicleId && v.ResidentUserId == residentUserId);

        if (vehicle == null)
        {
            throw new KeyNotFoundException("Araç kaydı bulunamadı.");
        }

        var normalizedVehicleType = dto.VehicleType?.ToUpperInvariant() ?? "CAR";
        var allowedTypes = new[] { "CAR", "MOTORCYCLE", "ELECTRIC_VEHICLE", "SUV", "OTHER" };
        if (!allowedTypes.Contains(normalizedVehicleType))
        {
            normalizedVehicleType = "CAR";
        }

        vehicle.VehicleType = normalizedVehicleType;
        vehicle.BrandModel = dto.BrandModel?.Trim();
        vehicle.Color = dto.Color?.Trim();
        vehicle.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return await GetVehicleDtoByIdAsync(vehicle.Id);
    }

    public async Task<ResidentVehicleDto> SetResidentVehicleStatusAsync(int residentUserId, long vehicleId, bool isActive)
    {
        var vehicle = await _context.ResidentVehicles
            .FirstOrDefaultAsync(v => v.Id == vehicleId && v.ResidentUserId == residentUserId);

        if (vehicle == null)
        {
            throw new KeyNotFoundException("Araç kaydı bulunamadı.");
        }

        if (isActive && !vehicle.IsActive)
        {
            // Check if another active vehicle has the same plate
            var isPlateActive = await _context.ResidentVehicles
                .AnyAsync(v => v.Id != vehicleId && v.PlateNumber == vehicle.PlateNumber && v.IsActive);

            if (isPlateActive)
            {
                throw new InvalidOperationException($"'{vehicle.PlateNumber}' plakasıyla aktif başka bir araç bulunduğundan bu araç aktifleştirilemez.");
            }
        }

        vehicle.IsActive = isActive;
        vehicle.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return await GetVehicleDtoByIdAsync(vehicle.Id);
    }

    public async Task<PagedResidentVehicleResultDto> GetManagementVehiclesAsync(int userId, bool isAdmin, ResidentVehicleFilterDto filter)
    {
        var query = _context.ResidentVehicles
            .AsNoTracking()
            .Include(v => v.ResidentUser)
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .AsQueryable();

        // Scope Enforcement
        if (!isAdmin)
        {
            var accessibleBuildingIds = await _scopeService.GetAccessibleBuildingIdsAsync(userId, false);
            query = query.Where(v => accessibleBuildingIds.Contains(v.Unit.BuildingId));
        }

        // Filters
        if (filter.PropertyId.HasValue)
        {
            query = query.Where(v => v.Unit.Building.PropertyId == filter.PropertyId.Value);
        }

        if (filter.BuildingId.HasValue)
        {
            query = query.Where(v => v.Unit.BuildingId == filter.BuildingId.Value);
        }

        if (filter.UnitId.HasValue)
        {
            query = query.Where(v => v.UnitId == filter.UnitId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.PlateNumber))
        {
            var normalized = NormalizePlate(filter.PlateNumber);
            query = query.Where(v => v.PlateNumber.Contains(normalized));
        }

        if (!string.IsNullOrWhiteSpace(filter.VehicleType))
        {
            query = query.Where(v => v.VehicleType == filter.VehicleType.ToUpperInvariant());
        }

        if (filter.IsActive.HasValue)
        {
            query = query.Where(v => v.IsActive == filter.IsActive.Value);
        }

        var totalCount = await query.CountAsync();
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));

        var items = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResidentVehicleResultDto
        {
            Items = items.Select(ToDto).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
        };
    }

    private static string NormalizePlate(string plate)
    {
        if (string.IsNullOrWhiteSpace(plate)) return "";
        var trimmed = plate.Trim();
        var singleSpaced = Regex.Replace(trimmed, @"\s+", " ");
        return singleSpaced.ToUpperInvariant();
    }

    private async Task<ResidentVehicleDto> GetVehicleDtoByIdAsync(long vehicleId)
    {
        var vehicle = await _context.ResidentVehicles
            .AsNoTracking()
            .Include(v => v.ResidentUser)
            .Include(v => v.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .FirstAsync(v => v.Id == vehicleId);

        return ToDto(vehicle);
    }

    private static ResidentVehicleDto ToDto(ResidentVehicle v)
    {
        return new ResidentVehicleDto
        {
            Id = v.Id,
            ResidentUserId = v.ResidentUserId,
            ResidentUserName = v.ResidentUser != null ? $"{v.ResidentUser.FirstName} {v.ResidentUser.LastName}".Trim() : "",
            UnitId = v.UnitId,
            UnitNumber = v.Unit?.UnitNumber ?? "",
            BuildingName = v.Unit?.Building?.Name ?? "",
            PropertyName = v.Unit?.Building?.Property?.Name ?? "",
            PropertyId = v.Unit?.Building?.PropertyId ?? 0,
            BuildingId = v.Unit?.BuildingId ?? 0,
            PlateNumber = v.PlateNumber,
            VehicleType = v.VehicleType,
            BrandModel = v.BrandModel,
            Color = v.Color,
            IsActive = v.IsActive,
            CreatedAt = v.CreatedAt,
            UpdatedAt = v.UpdatedAt,
        };
    }
}
