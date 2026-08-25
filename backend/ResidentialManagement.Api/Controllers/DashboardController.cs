using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;
    private readonly IManagerScopeService _managerScopeService;

    public DashboardController(
        IDashboardService dashboardService,
        IManagerScopeService managerScopeService)
    {
        _dashboardService = dashboardService;
        _managerScopeService = managerScopeService;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary()
    {
        IReadOnlyCollection<int>? accessiblePropertyIds = null;
        IReadOnlyCollection<int>? accessibleBuildingIds = null;

        if (User.IsInRole(AppRoles.Manager) && !User.IsInRole(AppRoles.Admin))
        {
            var userId = GetCurrentUserId();
            accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(
                userId,
                isAdmin: false);
            accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(
                userId,
                isAdmin: false);
        }

        return Ok(await _dashboardService.GetSummaryAsync(
            accessiblePropertyIds,
            accessibleBuildingIds));
    }

    [HttpGet("activity-feed")]
    public async Task<ActionResult<PagedActivityFeedDto>> GetActivityFeed(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 6,
        [FromQuery] int? limit = null)
    {
        if (limit.HasValue && limit.Value > 0)
        {
            pageSize = limit.Value;
        }

        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var result = await _dashboardService.GetActivityFeedPagedAsync(page, pageSize, userId, isAdmin);
        return Ok(result);
    }

    private int GetCurrentUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(value, out var userId))
        {
            throw new UnauthorizedException("Oturum kullanıcı bilgisi doğrulanamadı.");
        }

        return userId;
    }
}
