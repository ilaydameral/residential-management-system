using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/management/vehicles")]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
public class ManagementVehiclesController : ControllerBase
{
    private readonly IResidentVehicleService _vehicleService;

    public ManagementVehiclesController(IResidentVehicleService vehicleService)
    {
        _vehicleService = vehicleService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResidentVehicleResultDto>> GetVehicles([FromQuery] ResidentVehicleFilterDto filter)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var result = await _vehicleService.GetManagementVehiclesAsync(userId, isAdmin, filter);
        return Ok(result);
    }

    private int GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(userIdStr, out var id) ? id : 0;
    }
}
