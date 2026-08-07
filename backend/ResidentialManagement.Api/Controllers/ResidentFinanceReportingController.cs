using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/resident/finance/reporting")]
[Authorize(Roles = AppRoles.Resident)]
public class ResidentFinanceReportingController : ControllerBase
{
    private readonly IFinancialReportingService _financialReportingService;

    public ResidentFinanceReportingController(IFinancialReportingService financialReportingService)
    {
        _financialReportingService = financialReportingService;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ResidentFinanceSummaryDto>> GetSummary()
    {
        var summary = await _financialReportingService.GetResidentSummaryAsync(GetCurrentUserId());
        return Ok(summary);
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
