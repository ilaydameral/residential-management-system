using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PropertiesController : ControllerBase
{
    private readonly IPropertyService _propertyService;
    private readonly IManagerScopeService _managerScopeService;

    public PropertiesController(
        IPropertyService propertyService,
        IManagerScopeService managerScopeService)
    {
        _propertyService = propertyService;
        _managerScopeService = managerScopeService;
    }

    [HttpGet]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<List<PropertyDto>>> GetProperties([FromQuery] bool includeInactive = false)
    {
        IReadOnlyCollection<int>? accessiblePropertyIds = null;
        IReadOnlyCollection<int>? accessibleBuildingIds = null;
        if (IsManagerOnly())
        {
            var userId = GetCurrentUserId();
            accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(
                userId,
                isAdmin: false);
            accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(
                userId,
                isAdmin: false);
        }

        var properties = await _propertyService.GetAllPropertiesAsync(
            includeInactive,
            accessiblePropertyIds,
            accessibleBuildingIds);
        return Ok(properties);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = AppRoles.AnyRole)]
    public async Task<ActionResult<PropertyDto>> GetPropertyById(int id)
    {
        await EnsureManagerCanViewPropertyAsync(id);

        var property = await _propertyService.GetPropertyByIdAsync(
            id,
            IsManagerOnly()
                ? await _managerScopeService.GetAccessibleBuildingIdsAsync(
                    GetCurrentUserId(),
                    isAdmin: false)
                : null);
        if (property is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(property);
    }

    [HttpPost]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<PropertyDto>> CreateProperty(CreatePropertyDto createDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var createdProperty = await _propertyService.CreatePropertyAsync(createDto);

        return CreatedAtAction(
            nameof(GetPropertyById),
            new { id = createdProperty.Id },
            createdProperty
        );
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<PropertyDto>> UpdateProperty(int id, UpdatePropertyDto updateDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        await EnsureManagerCanManagePropertyAsync(id);

        var updatedProperty = await _propertyService.UpdatePropertyAsync(id, updateDto);
        if (updatedProperty is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(updatedProperty);
    }

    [HttpPatch("{id:int}/deactivate")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<IActionResult> DeactivateProperty(int id)
    {
        await EnsureManagerCanManagePropertyAsync(id);

        var success = await _propertyService.DeactivatePropertyAsync(id);
        if (!success)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul bulunamadı.",
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

    private async Task EnsureManagerCanViewPropertyAsync(int propertyId)
    {
        if (IsManagerOnly() && !await _managerScopeService.CanViewPropertyAsync(
            GetCurrentUserId(),
            propertyId,
            isAdmin: false))
        {
            throw new ForbiddenException("Bu yapıyı görüntüleme yetkiniz bulunmamaktadır.");
        }
    }

    private async Task EnsureManagerCanManagePropertyAsync(int propertyId)
    {
        if (IsManagerOnly() && !await _managerScopeService.CanManagePropertyAsync(
            GetCurrentUserId(),
            propertyId,
            isAdmin: false))
        {
            throw new ForbiddenException("Bu yapı üzerinde işlem yapma yetkiniz bulunmamaktadır.");
        }
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<IActionResult> DeleteProperty(int id)
    {
        var success = await _propertyService.DeletePropertyAsync(id);
        if (!success)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return NoContent();
    }
}
