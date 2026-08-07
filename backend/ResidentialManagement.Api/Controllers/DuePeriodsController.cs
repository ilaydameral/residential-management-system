using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/due-periods")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class DuePeriodsController : ControllerBase
{
    private readonly IDuePeriodService _duePeriodService;

    public DuePeriodsController(IDuePeriodService duePeriodService)
    {
        _duePeriodService = duePeriodService;
    }

    [HttpGet]
    public async Task<ActionResult<List<DuePeriodDto>>> GetAll(
        [FromQuery] int? dueDefinitionId,
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] string? status)
    {
        var result = await _duePeriodService.GetAllAsync(
            GetCurrentUserId(),
            IsAdmin(),
            dueDefinitionId,
            year,
            month,
            status);

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DuePeriodDto>> GetById(int id)
    {
        var result = await _duePeriodService.GetByIdAsync(id, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<DuePeriodDto>> CreateDraft([FromBody] CreateDraftDuePeriodDto createDto)
    {
        var result = await _duePeriodService.CreateDraftPeriodAsync(createDto, GetCurrentUserId(), IsAdmin());
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpGet("{id:int}/preview")]
    public async Task<ActionResult<IssuePeriodPreviewDto>> GetPreview(int id)
    {
        var result = await _duePeriodService.GetIssuePreviewAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/issue")]
    public async Task<ActionResult<IssuePeriodResultDto>> Issue(int id)
    {
        var result = await _duePeriodService.IssuePeriodAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<DuePeriodDto>> Cancel(int id, [FromBody] CancelDuePeriodDto cancelDto)
    {
        var result = await _duePeriodService.CancelDraftPeriodAsync(id, cancelDto, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
    }

    [HttpGet("{id:int}/collection-details")]
    public async Task<ActionResult<DuePeriodCollectionDetailsDto>> GetCollectionDetails(int id)
    {
        var result = await _duePeriodService.GetCollectionDetailsAsync(id, GetCurrentUserId(), IsAdmin());
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
            Message = $"ID'si {id} olan aidat dönemi bulunamadı.",
            Timestamp = DateTime.UtcNow
        };
    }
}
