using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/unit-occupancies")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class UnitOccupanciesController : ControllerBase
{
    private readonly IUnitOccupancyService _unitOccupancyService;

    public UnitOccupanciesController(IUnitOccupancyService unitOccupancyService)
    {
        _unitOccupancyService = unitOccupancyService;
    }

    [HttpGet("~/api/units/{unitId:int}/occupancies")]
    public async Task<ActionResult<List<UnitOccupancyDto>>> GetByUnitId(
        int unitId,
        [FromQuery] bool includeInactive = false)
    {
        var occupancies = await _unitOccupancyService.GetByUnitIdAsync(unitId, includeInactive);
        if (occupancies is null)
        {
            return NotFound(CreateErrorResponse(404, $"ID'si {unitId} olan bölüm bulunamadı."));
        }

        return Ok(occupancies);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<UnitOccupancyDto>> GetById(int id)
    {
        var occupancy = await _unitOccupancyService.GetByIdAsync(id);
        if (occupancy is null)
        {
            return NotFound(CreateErrorResponse(404, $"ID'si {id} olan ikamet ilişkisi bulunamadı."));
        }

        return Ok(occupancy);
    }

    [HttpPost("~/api/units/{unitId:int}/occupancies")]
    public async Task<ActionResult<UnitOccupancyDto>> Create(
        int unitId,
        [FromBody] CreateUnitOccupancyDto createDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var createdOccupancy = await _unitOccupancyService.CreateAsync(unitId, createDto);

        return CreatedAtAction(
            nameof(GetById),
            new { id = createdOccupancy.Id },
            createdOccupancy
        );
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UnitOccupancyDto>> Update(
        int id,
        [FromBody] UpdateUnitOccupancyDto updateDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var updatedOccupancy = await _unitOccupancyService.UpdateAsync(id, updateDto);
        if (updatedOccupancy is null)
        {
            return NotFound(CreateErrorResponse(404, $"ID'si {id} olan ikamet ilişkisi bulunamadı."));
        }

        return Ok(updatedOccupancy);
    }

    [HttpPost("{id:int}/close")]
    public async Task<ActionResult<UnitOccupancyDto>> End(
        int id,
        [FromBody] EndUnitOccupancyDto endDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var endedOccupancy = await _unitOccupancyService.EndAsync(id, endDto);
        if (endedOccupancy is null)
        {
            return NotFound(CreateErrorResponse(404, $"ID'si {id} olan ikamet ilişkisi bulunamadı."));
        }

        return Ok(endedOccupancy);
    }

    private static ErrorResponse CreateErrorResponse(int statusCode, string message)
    {
        return new ErrorResponse
        {
            StatusCode = statusCode,
            Message = message,
            Timestamp = DateTime.UtcNow
        };
    }
}
