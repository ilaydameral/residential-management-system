using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/buildings")]
[Authorize]
public class BuildingsController : ControllerBase
{
    private readonly IBuildingService _buildingService;
    private readonly IManagerScopeService _managerScopeService;

    public BuildingsController(
        IBuildingService buildingService,
        IManagerScopeService managerScopeService)
    {
        _buildingService = buildingService;
        _managerScopeService = managerScopeService;
    }

    [HttpGet]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<List<BuildingDto>>> GetBuildings([FromQuery] bool includeInactive = false)
    {
        IReadOnlyCollection<int>? accessibleBuildingIds = null;
        if (IsManagerOnly())
        {
            accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(
                GetCurrentUserId(),
                isAdmin: false);
        }

        var buildings = await _buildingService.GetAllBuildingsAsync(
            includeInactive,
            accessibleBuildingIds);
        return Ok(buildings);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<BuildingDto>> GetBuildingById(int id)
    {
        await EnsureManagerCanAccessBuildingAsync(id);

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
        IReadOnlyCollection<int>? accessibleBuildingIds = null;
        if (IsManagerOnly())
        {
            var userId = GetCurrentUserId();
            if (!await _managerScopeService.CanViewPropertyAsync(userId, propertyId, isAdmin: false))
            {
                throw new ForbiddenException("Bu yapının bloklarını görüntüleme yetkiniz bulunmamaktadır.");
            }

            accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(
                userId,
                isAdmin: false);
        }

        var buildings = await _buildingService.GetBuildingsByPropertyIdAsync(
            propertyId,
            includeInactive,
            accessibleBuildingIds);
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

        await EnsureManagerCanManagePropertyAsync(createDto.PropertyId);

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

        await EnsureManagerCanAccessBuildingAsync(id);

        if (IsManagerOnly())
        {
            var existingBuilding = await _buildingService.GetBuildingByIdAsync(id);
            if (existingBuilding is not null && existingBuilding.PropertyId != updateDto.PropertyId)
            {
                await EnsureManagerCanManagePropertyAsync(existingBuilding.PropertyId);
                await EnsureManagerCanManagePropertyAsync(updateDto.PropertyId);
            }
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

    private bool IsManagerOnly()
    {
        return User.IsInRole(AppRoles.Manager) && !User.IsInRole(AppRoles.Admin);
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

    private async Task EnsureManagerCanAccessBuildingAsync(int buildingId)
    {
        if (IsManagerOnly() && !await _managerScopeService.CanAccessBuildingAsync(
            GetCurrentUserId(),
            buildingId,
            isAdmin: false))
        {
            throw new ForbiddenException("Bu blok üzerinde işlem yapma yetkiniz bulunmamaktadır.");
        }
    }

    private async Task EnsureManagerCanManagePropertyAsync(int propertyId)
    {
        if (IsManagerOnly() && !await _managerScopeService.CanManagePropertyAsync(
            GetCurrentUserId(),
            propertyId,
            isAdmin: false))
        {
            throw new ForbiddenException("Bu yapı altında blok oluşturma veya taşıma yetkiniz bulunmamaktadır.");
        }
    }
}
