using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/management/finance/reporting")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class ManagementFinanceReportingController : ControllerBase
{
    private readonly IFinancialReportingService _financialReportingService;

    public ManagementFinanceReportingController(IFinancialReportingService financialReportingService)
    {
        _financialReportingService = financialReportingService;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ManagementFinanceSummaryDto>> GetSummary()
    {
        var summary = await _financialReportingService.GetManagementSummaryAsync(GetCurrentUserId(), IsAdmin());
        return Ok(summary);
    }

    [HttpGet("monthly-collections")]
    public async Task<ActionResult<List<MonthlyCollectionSummaryDto>>> GetMonthlyCollections()
    {
        var result = await _financialReportingService.GetManagementMonthlyCollectionsAsync(GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpGet("highest-outstanding-units")]
    public async Task<ActionResult<List<UnitOutstandingReportDto>>> GetHighestOutstandingUnits([FromQuery] int count = 10)
    {
        var limit = Math.Clamp(count, 1, 100);
        var result = await _financialReportingService.GetHighestOutstandingUnitsAsync(GetCurrentUserId(), IsAdmin(), limit);
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

    private bool IsAdmin() => User.IsInRole(AppRoles.Admin);
}
