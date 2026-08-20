using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Hubs;

[Authorize]
public class RealtimeHub : Hub
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;

    public RealtimeHub(AppDbContext context, IManagerScopeService managerScopeService)
    {
        _context = context;
        _managerScopeService = managerScopeService;
    }

    public override async Task OnConnectedAsync()
    {
        var userIdString = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? Context.UserIdentifier;

        if (!int.TryParse(userIdString, out var userId) || userId <= 0)
        {
            Context.Abort();
            return;
        }

        // Always join personal user group
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");

        // Check user roles
        var roles = Context.User?.Claims
            .Where(c => c.Type == ClaimTypes.Role)
            .Select(c => c.Value)
            .ToList() ?? new List<string>();

        var isAdmin = roles.Contains(AppRoles.Admin);
        var isManager = roles.Contains(AppRoles.Manager);
        var isResident = roles.Contains(AppRoles.Resident);

        if (isAdmin)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "role:ADMIN");
        }

        if (isManager)
        {
            var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(userId, false);
            foreach (var propId in accessiblePropertyIds)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"property:{propId}");
            }

            var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(userId, false);
            foreach (var bldId in accessibleBuildingIds)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"building:{bldId}");
            }
        }

        if (isResident)
        {
            var now = DateTime.UtcNow;
            var activeOccupancies = await _context.UnitOccupancies
                .AsNoTracking()
                .Include(uo => uo.Unit)
                .Where(uo => uo.UserId == userId && uo.IsActive && (uo.EndDate == null || uo.EndDate > now))
                .Select(uo => new { uo.Unit.BuildingId, uo.Unit.Building.PropertyId })
                .Distinct()
                .ToListAsync();

            foreach (var occ in activeOccupancies)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"property:{occ.PropertyId}");
                await Groups.AddToGroupAsync(Context.ConnectionId, $"building:{occ.BuildingId}");
            }
        }

        await base.OnConnectedAsync();
    }
}
