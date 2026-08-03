using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/resident")]
[Authorize(Roles = AppRoles.Resident)]
public class ResidentController : ControllerBase
{
    private readonly IUnitService _unitService;

    public ResidentController(IUnitService unitService)
    {
        _unitService = unitService;
    }

    [HttpGet("my-units")]
    public async Task<ActionResult<List<ResidentUnitDto>>> GetMyUnits()
    {
        if (User.IsInRole(AppRoles.Admin) ||
            User.IsInRole(AppRoles.Manager) ||
            User.IsInRole(AppRoles.TechnicalStaff))
        {
            return Forbid();
        }

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedException("Kimliği doğrulanmış kullanıcı bilgisi geçersizdir.");
        }

        return Ok(await _unitService.GetResidentUnitsAsync(userId));
    }
}
