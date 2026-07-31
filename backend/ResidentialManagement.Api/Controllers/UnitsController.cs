using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/units")]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly IUnitService _unitService;

    public UnitsController(IUnitService unitService)
    {
        _unitService = unitService;
    }

    [HttpGet]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<List<UnitDto>>> GetUnits([FromQuery] bool includeInactive = false)
    {
        var units = await _unitService.GetAllUnitsAsync(includeInactive);
        return Ok(units);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<UnitDto>> GetUnitById(int id)
    {
        var unit = await _unitService.GetUnitByIdAsync(id);
        if (unit is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan bölüm bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(unit);
    }

    [HttpGet("building/{buildingId:int}")]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<List<UnitDto>>> GetUnitsByBuildingId(int buildingId, [FromQuery] bool includeInactive = false)
    {
        var units = await _unitService.GetUnitsByBuildingIdAsync(buildingId, includeInactive);
        if (units is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {buildingId} olan bina bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(units);
    }

    [HttpGet("property/{propertyId:int}")]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<List<UnitDto>>> GetUnitsByPropertyId(int propertyId, [FromQuery] bool includeInactive = false)
    {
        var units = await _unitService.GetUnitsByPropertyIdAsync(propertyId, includeInactive);
        if (units is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {propertyId} olan gayrimenkul bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(units);
    }

    [HttpPost]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<UnitDto>> CreateUnit(CreateUnitDto createDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var createdUnit = await _unitService.CreateUnitAsync(createDto);

        return CreatedAtAction(
            nameof(GetUnitById),
            new { id = createdUnit.Id },
            createdUnit
        );
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<UnitDto>> UpdateUnit(int id, UpdateUnitDto updateDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var updatedUnit = await _unitService.UpdateUnitAsync(id, updateDto);
        if (updatedUnit is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan bölüm bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(updatedUnit);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<IActionResult> DeleteUnit(int id)
    {
        var deleted = await _unitService.DeleteUnitAsync(id);
        if (!deleted)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan bölüm bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return NoContent();
    }
}
