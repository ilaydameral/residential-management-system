using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/facilities")]
[Authorize]
public class FacilitiesController : ControllerBase
{
    private readonly IFacilityService _facilityService;

    public FacilitiesController(IFacilityService facilityService)
    {
        _facilityService = facilityService;
    }

    [HttpGet]
    public async Task<ActionResult<List<CommonFacilityDto>>> GetAll(
        [FromQuery] int? propertyId,
        [FromQuery] int? buildingId,
        [FromQuery] bool? isActive)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var facilities = await _facilityService.GetAllFacilitiesAsync(userId, isAdmin, propertyId, buildingId, isActive);
        return Ok(facilities);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CommonFacilityDto>> GetById(int id)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var facility = await _facilityService.GetFacilityByIdAsync(id, userId, isAdmin);
        if (facility is null) return NotFound();
        return Ok(facility);
    }

    [HttpPost]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<CommonFacilityDto>> Create([FromBody] CreateCommonFacilityDto dto)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var facility = await _facilityService.CreateFacilityAsync(dto, userId, isAdmin);
        return CreatedAtAction(nameof(GetById), new { id = facility.Id }, facility);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<CommonFacilityDto>> Update(int id, [FromBody] UpdateCommonFacilityDto dto)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var facility = await _facilityService.UpdateFacilityAsync(id, dto, userId, isAdmin);
        return Ok(facility);
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<CommonFacilityDto>> SetStatus(int id, [FromQuery] bool isActive)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var facility = await _facilityService.SetFacilityActiveStatusAsync(id, isActive, userId, isAdmin);
        return Ok(facility);
    }

    [HttpGet("{facilityId}/maintenance-blocks")]
    public async Task<ActionResult<List<FacilityMaintenanceBlockDto>>> GetMaintenanceBlocks(int facilityId)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var blocks = await _facilityService.GetMaintenanceBlocksAsync(facilityId, userId, isAdmin);
        return Ok(blocks);
    }

    [HttpPost("{facilityId}/maintenance-blocks")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<FacilityMaintenanceBlockDto>> CreateMaintenanceBlock(int facilityId, [FromBody] CreateMaintenanceBlockDto dto)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var block = await _facilityService.CreateMaintenanceBlockAsync(facilityId, dto, userId, isAdmin);
        return Ok(block);
    }

    [HttpDelete("maintenance-blocks/{blockId}")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<IActionResult> DeleteMaintenanceBlock(int blockId)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        await _facilityService.DeleteMaintenanceBlockAsync(blockId, userId, isAdmin);
        return NoContent();
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
