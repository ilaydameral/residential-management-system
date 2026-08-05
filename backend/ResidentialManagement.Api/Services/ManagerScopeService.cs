using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class ManagerScopeService : IManagerScopeService
{
    private readonly AppDbContext _context;

    public ManagerScopeService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<int>> GetAccessiblePropertyIdsAsync(int userId, bool isAdmin)
    {
        if (isAdmin)
        {
            return await _context.Properties
                .AsNoTracking()
                .Select(property => property.Id)
                .ToListAsync();
        }

        return await ActiveAssignments(userId)
            .Select(assignment => assignment.PropertyId)
            .Distinct()
            .ToListAsync();
    }

    public async Task<List<int>> GetAccessibleBuildingIdsAsync(int userId, bool isAdmin)
    {
        if (isAdmin)
        {
            return await _context.Buildings
                .AsNoTracking()
                .Select(building => building.Id)
                .ToListAsync();
        }

        var propertyScopeBuildingIds = ActiveAssignments(userId)
            .Where(assignment => assignment.BuildingId == null)
            .SelectMany(assignment => assignment.Property.Buildings)
            .Select(building => building.Id);

        var buildingScopeIds = ActiveAssignments(userId)
            .Where(assignment => assignment.BuildingId != null)
            .Select(assignment => assignment.BuildingId!.Value);

        return await propertyScopeBuildingIds
            .Concat(buildingScopeIds)
            .Distinct()
            .ToListAsync();
    }

    public async Task<bool> CanViewPropertyAsync(int userId, int propertyId, bool isAdmin)
    {
        if (isAdmin)
        {
            return true;
        }

        return await ActiveAssignments(userId)
            .AnyAsync(assignment => assignment.PropertyId == propertyId);
    }

    public async Task<bool> CanManagePropertyAsync(int userId, int propertyId, bool isAdmin)
    {
        if (isAdmin)
        {
            return true;
        }

        return await ActiveAssignments(userId)
            .AnyAsync(assignment =>
                assignment.PropertyId == propertyId &&
                assignment.BuildingId == null);
    }

    public async Task<bool> CanAccessBuildingAsync(int userId, int buildingId, bool isAdmin)
    {
        if (isAdmin)
        {
            return true;
        }

        return await _context.Buildings
            .AsNoTracking()
            .Where(building => building.Id == buildingId)
            .AnyAsync(building => ActiveAssignments(userId).Any(assignment =>
                assignment.PropertyId == building.PropertyId &&
                (assignment.BuildingId == null || assignment.BuildingId == building.Id)));
    }

    public async Task<bool> CanAccessUnitAsync(int userId, int unitId, bool isAdmin)
    {
        if (isAdmin)
        {
            return true;
        }

        return await _context.Units
            .AsNoTracking()
            .Where(unit => unit.Id == unitId)
            .AnyAsync(unit => ActiveAssignments(userId).Any(assignment =>
                assignment.PropertyId == unit.Building.PropertyId &&
                (assignment.BuildingId == null || assignment.BuildingId == unit.BuildingId)));
    }

    private IQueryable<ManagerAssignment> ActiveAssignments(int userId)
    {
        return _context.ManagerAssignments
            .AsNoTracking()
            .Where(assignment =>
                assignment.ManagerUserId == userId &&
                assignment.IsActive &&
                assignment.ManagerUser.IsActive &&
                assignment.ManagerUser.UserRoles.Any(userRole =>
                    userRole.Role.IsActive &&
                    userRole.Role.Code == AppRoles.Manager));
    }
}
