using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/resident/vehicles")]
[Authorize(Roles = AppRoles.Resident)]
public class ResidentVehiclesController : ControllerBase
{
    private readonly IResidentVehicleService _vehicleService;

    public ResidentVehiclesController(IResidentVehicleService vehicleService)
    {
        _vehicleService = vehicleService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ResidentVehicleDto>>> GetMyVehicles()
    {
        var residentUserId = GetCurrentUserId();
        var vehicles = await _vehicleService.GetResidentVehiclesAsync(residentUserId);
        return Ok(vehicles);
    }

    [HttpPost]
    public async Task<ActionResult<ResidentVehicleDto>> Create([FromBody] CreateResidentVehicleDto dto)
    {
        var residentUserId = GetCurrentUserId();
        try
        {
            var vehicle = await _vehicleService.CreateVehicleAsync(residentUserId, dto);
            return CreatedAtAction(nameof(GetMyVehicles), null, vehicle);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ResidentVehicleDto>> Update(long id, [FromBody] UpdateResidentVehicleDto dto)
    {
        var residentUserId = GetCurrentUserId();
        try
        {
            var vehicle = await _vehicleService.UpdateResidentVehicleAsync(residentUserId, id, dto);
            return Ok(vehicle);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id}/status")]
    public async Task<ActionResult<ResidentVehicleDto>> SetStatus(long id, [FromQuery] bool isActive)
    {
        var residentUserId = GetCurrentUserId();
        try
        {
            var vehicle = await _vehicleService.SetResidentVehicleStatusAsync(residentUserId, id, isActive);
            return Ok(vehicle);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private int GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(userIdStr, out var id) ? id : 0;
    }
}
