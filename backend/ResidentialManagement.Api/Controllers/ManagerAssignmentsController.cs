using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/manager-assignments")]
[Authorize(Roles = AppRoles.Admin)]
public class ManagerAssignmentsController : ControllerBase
{
    private readonly IManagerAssignmentService _managerAssignmentService;

    public ManagerAssignmentsController(IManagerAssignmentService managerAssignmentService)
    {
        _managerAssignmentService = managerAssignmentService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ManagerAssignmentDto>>> GetAll(
        [FromQuery] int? managerUserId,
        [FromQuery] int? propertyId,
        [FromQuery] int? buildingId,
        [FromQuery] bool? isActive)
    {
        return Ok(await _managerAssignmentService.GetAllAsync(
            managerUserId,
            propertyId,
            buildingId,
            isActive));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ManagerAssignmentDto>> GetById(int id)
    {
        var assignment = await _managerAssignmentService.GetByIdAsync(id);
        return assignment is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(assignment);
    }

    [HttpPost]
    public async Task<ActionResult<ManagerAssignmentDto>> Create(
        [FromBody] CreateManagerAssignmentDto createDto)
    {
        var assignment = await _managerAssignmentService.CreateAsync(
            createDto,
            GetCurrentUserId());

        return CreatedAtAction(nameof(GetById), new { id = assignment.Id }, assignment);
    }

    [HttpPost("{id:int}/end")]
    public async Task<ActionResult<ManagerAssignmentDto>> End(
        int id,
        [FromBody] EndManagerAssignmentDto endDto)
    {
        var assignment = await _managerAssignmentService.EndAsync(
            id,
            endDto,
            GetCurrentUserId());

        return assignment is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(assignment);
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

    private static ErrorResponse CreateNotFoundResponse(int id)
    {
        return new ErrorResponse
        {
            StatusCode = 404,
            Message = $"ID'si {id} olan yönetici ataması bulunamadı.",
            Timestamp = DateTime.UtcNow
        };
    }
}
