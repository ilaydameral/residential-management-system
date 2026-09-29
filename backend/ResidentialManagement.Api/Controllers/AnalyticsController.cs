using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/analytics")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analyticsService;

    public AnalyticsController(IAnalyticsService analyticsService) => _analyticsService = analyticsService;

    [HttpGet("finance")]
    public async Task<ActionResult<FinanceAnalyticsDto>> GetFinance(
        [FromQuery] int? propertyId, [FromQuery] int? buildingId,
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        => Ok(await _analyticsService.GetFinanceAsync(
            CurrentUserId(), IsAdmin(), propertyId, buildingId, fromDate, toDate));

    [HttpGet("maintenance")]
    public async Task<ActionResult<MaintenanceAnalyticsDto>> GetMaintenance(
        [FromQuery] int? propertyId, [FromQuery] int? buildingId,
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        => Ok(await _analyticsService.GetMaintenanceAsync(
            CurrentUserId(), IsAdmin(), propertyId, buildingId, fromDate, toDate));

    [HttpGet("facilities")]
    public async Task<ActionResult<FacilityAnalyticsDto>> GetFacilities(
        [FromQuery] int? propertyId, [FromQuery] int? buildingId,
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        => Ok(await _analyticsService.GetFacilitiesAsync(
            CurrentUserId(), IsAdmin(), propertyId, buildingId, fromDate, toDate));

    private bool IsAdmin() => User.IsInRole(AppRoles.Admin);

    private int CurrentUserId()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
            throw new UnauthorizedException("Oturum kullanıcı bilgisi doğrulanamadı.");
        return id;
    }
}
