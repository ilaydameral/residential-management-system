using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/buildings")]
[Authorize]
public class BuildingsController : ControllerBase
{
    private readonly IBuildingService _buildingService;

    public BuildingsController(IBuildingService buildingService)
    {
        _buildingService = buildingService;
    }

    [HttpGet]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<List<BuildingDto>>> GetBuildings([FromQuery] bool includeInactive = false)
    {
        var buildings = await _buildingService.GetAllBuildingsAsync(includeInactive);
        return Ok(buildings);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<BuildingDto>> GetBuildingById(int id)
    {
        var building = await _buildingService.GetBuildingByIdAsync(id);
        if (building is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan bina bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(building);
    }

    [HttpGet("property/{propertyId:int}")]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<List<BuildingDto>>> GetBuildingsByPropertyId(int propertyId, [FromQuery] bool includeInactive = false)
    {
        var buildings = await _buildingService.GetBuildingsByPropertyIdAsync(propertyId, includeInactive);
        if (buildings is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {propertyId} olan gayrimenkul bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(buildings);
    }

    [HttpPost]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<BuildingDto>> CreateBuilding(CreateBuildingDto createDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var createdBuilding = await _buildingService.CreateBuildingAsync(createDto);

        return CreatedAtAction(
            nameof(GetBuildingById),
            new { id = createdBuilding.Id },
            createdBuilding
        );
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<BuildingDto>> UpdateBuilding(int id, UpdateBuildingDto updateDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var updatedBuilding = await _buildingService.UpdateBuildingAsync(id, updateDto);
        if (updatedBuilding is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan bina bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(updatedBuilding);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<IActionResult> DeleteBuilding(int id)
    {
        var deleted = await _buildingService.DeleteBuildingAsync(id);
        if (!deleted)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan bina bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return NoContent();
    }
}
