using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public class DashboardService : IDashboardService
{
    private readonly AppDbContext _context;

    public DashboardService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync()
    {
        var utcNow = DateTime.UtcNow;

        var propertyCount = await _context.Properties
            .AsNoTracking()
            .CountAsync(property => property.IsActive);

        var buildingCount = await _context.Buildings
            .AsNoTracking()
            .CountAsync(building => building.IsActive && building.Property.IsActive);

        var activeUnits = _context.Units
            .AsNoTracking()
            .Where(unit =>
                unit.IsActive &&
                unit.Building.IsActive &&
                unit.Building.Property.IsActive);

        var unitCount = await activeUnits.CountAsync();

        var activeOccupancies = _context.UnitOccupancies
            .AsNoTracking()
            .Where(occupancy =>
                occupancy.IsActive &&
                occupancy.StartDate <= utcNow &&
                (!occupancy.EndDate.HasValue || occupancy.EndDate.Value >= utcNow) &&
                occupancy.Unit.IsActive &&
                occupancy.Unit.Building.IsActive &&
                occupancy.Unit.Building.Property.IsActive);

        var activeOccupancyCount = await activeOccupancies.CountAsync();
        var occupiedUnitCount = await activeOccupancies
            .Select(occupancy => occupancy.UnitId)
            .Distinct()
            .CountAsync();

        return new DashboardSummaryDto
        {
            PropertyCount = propertyCount,
            BuildingCount = buildingCount,
            UnitCount = unitCount,
            ActiveOccupancyCount = activeOccupancyCount,
            OccupiedUnitCount = occupiedUnitCount,
            VacantUnitCount = unitCount - occupiedUnitCount
        };
    }
}
