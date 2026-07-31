using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/unit-types")]
[Authorize]
public class UnitTypesController : ControllerBase
{
    private readonly IUnitTypeService _unitTypeService;

    public UnitTypesController(IUnitTypeService unitTypeService)
    {
        _unitTypeService = unitTypeService;
    }

    [HttpGet]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<List<UnitTypeDto>>> GetUnitTypes([FromQuery] bool includeInactive = false)
    {
        var unitTypes = await _unitTypeService.GetAllUnitTypesAsync(includeInactive);
        return Ok(unitTypes);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<UnitTypeDto>> GetUnitTypeById(int id)
    {
        var unitType = await _unitTypeService.GetUnitTypeByIdAsync(id);
        if (unitType is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan bölüm türü bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(unitType);
    }

    [HttpPost]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<UnitTypeDto>> CreateUnitType(CreateUnitTypeDto createDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var createdUnitType = await _unitTypeService.CreateUnitTypeAsync(createDto);

        return CreatedAtAction(
            nameof(GetUnitTypeById),
            new { id = createdUnitType.Id },
            createdUnitType
        );
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<UnitTypeDto>> UpdateUnitType(int id, UpdateUnitTypeDto updateDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var updatedUnitType = await _unitTypeService.UpdateUnitTypeAsync(id, updateDto);
        if (updatedUnitType is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan bölüm türü bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(updatedUnitType);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<IActionResult> DeleteUnitType(int id)
    {
        var deleted = await _unitTypeService.DeleteUnitTypeAsync(id);
        if (!deleted)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan bölüm türü bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return NoContent();
    }
}
