using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/occupancy-types")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class OccupancyTypesController : ControllerBase
{
    private readonly IOccupancyTypeService _occupancyTypeService;

    public OccupancyTypesController(IOccupancyTypeService occupancyTypeService)
    {
        _occupancyTypeService = occupancyTypeService;
    }

    [HttpGet]
    public async Task<ActionResult<List<OccupancyTypeDto>>> GetAll()
    {
        return Ok(await _occupancyTypeService.GetActiveAsync());
    }
}
