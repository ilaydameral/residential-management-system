using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/units")]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly IUnitService _unitService;
    private readonly IManagerScopeService _managerScopeService;

    public UnitsController(
        IUnitService unitService,
        IManagerScopeService managerScopeService)
    {
        _unitService = unitService;
        _managerScopeService = managerScopeService;
    }

    [HttpGet]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<List<UnitDto>>> GetUnits([FromQuery] bool includeInactive = false)
    {
        var units = await _unitService.GetAllUnitsAsync(
            includeInactive,
            GetResidentUserId(),
            await GetManagerAccessibleBuildingIdsAsync());
        return Ok(units);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<UnitDto>> GetUnitById(int id)
    {
        await EnsureManagerCanAccessUnitAsync(id);

        var unit = await _unitService.GetUnitByIdAsync(id, GetResidentUserId());
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
        await EnsureManagerCanAccessBuildingAsync(buildingId);

        var units = await _unitService.GetUnitsByBuildingIdAsync(
            buildingId,
            includeInactive,
            GetResidentUserId(),
            await GetManagerAccessibleBuildingIdsAsync());
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
        if (IsManagerOnly() && !await _managerScopeService.CanViewPropertyAsync(
            GetCurrentUserId(),
            propertyId,
            isAdmin: false))
        {
            throw new ForbiddenException("Bu yapının dairelerini görüntüleme yetkiniz bulunmamaktadır.");
        }

        var units = await _unitService.GetUnitsByPropertyIdAsync(
            propertyId,
            includeInactive,
            GetResidentUserId(),
            await GetManagerAccessibleBuildingIdsAsync());
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

        await EnsureManagerCanAccessBuildingAsync(createDto.BuildingId);

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

        await EnsureManagerCanAccessUnitAsync(id);
        await EnsureManagerCanAccessBuildingAsync(updateDto.BuildingId);

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

    private int? GetResidentUserId()
    {
        if (!User.IsInRole(AppRoles.Resident) ||
            User.IsInRole(AppRoles.Admin) ||
            User.IsInRole(AppRoles.Manager))
        {
            return null;
        }

        return GetCurrentUserId();
    }

    private bool IsManagerOnly()
    {
        return User.IsInRole(AppRoles.Manager) && !User.IsInRole(AppRoles.Admin);
    }

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedException("Kimliği doğrulanmış kullanıcı bilgisi geçersizdir.");
        }

        return userId;
    }

    private async Task<IReadOnlyCollection<int>?> GetManagerAccessibleBuildingIdsAsync()
    {
        return IsManagerOnly()
            ? await _managerScopeService.GetAccessibleBuildingIdsAsync(
                GetCurrentUserId(),
                isAdmin: false)
            : null;
    }

    private async Task EnsureManagerCanAccessBuildingAsync(int buildingId)
    {
        if (IsManagerOnly() && !await _managerScopeService.CanAccessBuildingAsync(
            GetCurrentUserId(),
            buildingId,
            isAdmin: false))
        {
            throw new ForbiddenException("Bu bloğun dairelerine erişim yetkiniz bulunmamaktadır.");
        }
    }

    private async Task EnsureManagerCanAccessUnitAsync(int unitId)
    {
        if (IsManagerOnly() && !await _managerScopeService.CanAccessUnitAsync(
            GetCurrentUserId(),
            unitId,
            isAdmin: false))
        {
            throw new ForbiddenException("Bu daire üzerinde işlem yapma yetkiniz bulunmamaktadır.");
        }
    }
}
