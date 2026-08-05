using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/unit-occupancies")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class UnitOccupanciesController : ControllerBase
{
    private readonly IUnitOccupancyService _unitOccupancyService;
    private readonly IManagerScopeService _managerScopeService;

    public UnitOccupanciesController(
        IUnitOccupancyService unitOccupancyService,
        IManagerScopeService managerScopeService)
    {
        _unitOccupancyService = unitOccupancyService;
        _managerScopeService = managerScopeService;
    }

    [HttpGet]
    public async Task<ActionResult<List<UnitOccupancyDto>>> GetAll()
    {
        IReadOnlyCollection<int>? accessibleBuildingIds = null;
        if (IsManagerOnly())
        {
            accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(
                GetCurrentUserId(),
                isAdmin: false);
        }

        return Ok(await _unitOccupancyService.GetAllAsync(accessibleBuildingIds));
    }

    [HttpGet("~/api/units/{unitId:int}/occupancies")]
    public async Task<ActionResult<List<UnitOccupancyDto>>> GetByUnitId(
        int unitId,
        [FromQuery] bool includeInactive = false)
    {
        await EnsureManagerCanAccessUnitAsync(unitId);

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

        await EnsureManagerCanAccessUnitAsync(occupancy.UnitId);

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

        await EnsureManagerCanAccessUnitAsync(unitId);

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

        var existingOccupancy = await _unitOccupancyService.GetByIdAsync(id);
        if (existingOccupancy is null)
        {
            return NotFound(CreateErrorResponse(404, $"ID'si {id} olan ikamet ilişkisi bulunamadı."));
        }

        await EnsureManagerCanAccessUnitAsync(existingOccupancy.UnitId);

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

        var existingOccupancy = await _unitOccupancyService.GetByIdAsync(id);
        if (existingOccupancy is null)
        {
            return NotFound(CreateErrorResponse(404, $"ID'si {id} olan ikamet ilişkisi bulunamadı."));
        }

        await EnsureManagerCanAccessUnitAsync(existingOccupancy.UnitId);

        var endedOccupancy = await _unitOccupancyService.EndAsync(id, endDto);
        if (endedOccupancy is null)
        {
            return NotFound(CreateErrorResponse(404, $"ID'si {id} olan ikamet ilişkisi bulunamadı."));
        }

        return Ok(endedOccupancy);
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

    private async Task EnsureManagerCanAccessUnitAsync(int unitId)
    {
        if (IsManagerOnly() && !await _managerScopeService.CanAccessUnitAsync(
            GetCurrentUserId(),
            unitId,
            isAdmin: false))
        {
            throw new ForbiddenException("Bu dairenin sakin kayıtlarına erişim yetkiniz bulunmamaktadır.");
        }
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
