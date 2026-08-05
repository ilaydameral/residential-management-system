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

    public async Task<DashboardSummaryDto> GetSummaryAsync(
        IReadOnlyCollection<int>? accessiblePropertyIds = null,
        IReadOnlyCollection<int>? accessibleBuildingIds = null)
    {
        var utcNow = DateTime.UtcNow;

        var properties = _context.Properties
            .AsNoTracking()
            .Where(property => property.IsActive);

        if (accessiblePropertyIds is not null)
        {
            properties = properties.Where(property =>
                accessiblePropertyIds.Contains(property.Id));
        }

        var propertyCount = await properties.CountAsync();

        var buildings = _context.Buildings
            .AsNoTracking()
            .Where(building => building.IsActive && building.Property.IsActive);

        if (accessibleBuildingIds is not null)
        {
            buildings = buildings.Where(building =>
                accessibleBuildingIds.Contains(building.Id));
        }

        var buildingCount = await buildings.CountAsync();

        var activeUnits = _context.Units
            .AsNoTracking()
            .Where(unit =>
                unit.IsActive &&
                unit.Building.IsActive &&
                unit.Building.Property.IsActive);

        if (accessibleBuildingIds is not null)
        {
            activeUnits = activeUnits.Where(unit =>
                accessibleBuildingIds.Contains(unit.BuildingId));
        }

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

        if (accessibleBuildingIds is not null)
        {
            activeOccupancies = activeOccupancies.Where(occupancy =>
                accessibleBuildingIds.Contains(occupancy.Unit.BuildingId));
        }

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
