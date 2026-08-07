using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/due-definitions")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class DueDefinitionsController : ControllerBase
{
    private readonly IDueDefinitionService _dueDefinitionService;

    public DueDefinitionsController(IDueDefinitionService dueDefinitionService)
    {
        _dueDefinitionService = dueDefinitionService;
    }

    [HttpGet]
    public async Task<ActionResult<List<DueDefinitionDto>>> GetAll(
        [FromQuery] int? propertyId,
        [FromQuery] int? buildingId,
        [FromQuery] bool? isActive)
    {
        var result = await _dueDefinitionService.GetAllAsync(
            GetCurrentUserId(),
            IsAdmin(),
            propertyId,
            buildingId,
            isActive);

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DueDefinitionDto>> GetById(int id)
    {
        var result = await _dueDefinitionService.GetByIdAsync(id, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<DueDefinitionDto>> Create([FromBody] CreateDueDefinitionDto createDto)
    {
        var result = await _dueDefinitionService.CreateAsync(createDto, GetCurrentUserId(), IsAdmin());
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<DueDefinitionDto>> Update(int id, [FromBody] UpdateDueDefinitionDto updateDto)
    {
        var result = await _dueDefinitionService.UpdateAsync(id, updateDto, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
    }

    [HttpPatch("{id:int}/activate")]
    public async Task<ActionResult<DueDefinitionDto>> Activate(int id)
    {
        var result = await _dueDefinitionService.SetActiveAsync(id, true, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
    }

    [HttpPatch("{id:int}/deactivate")]
    public async Task<ActionResult<DueDefinitionDto>> Deactivate(int id)
    {
        var result = await _dueDefinitionService.SetActiveAsync(id, false, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
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

    private bool IsAdmin() => User.IsInRole(AppRoles.Admin);

    private static ErrorResponse CreateNotFoundResponse(int id)
    {
        return new ErrorResponse
        {
            StatusCode = 404,
            Message = $"ID'si {id} olan aidat tanımı bulunamadı.",
            Timestamp = DateTime.UtcNow
        };
    }
}
