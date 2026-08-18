using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/maintenance-requests")]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
public class MaintenanceRequestsController : ControllerBase
{
    private readonly IMaintenanceRequestService _requestService;

    public MaintenanceRequestsController(IMaintenanceRequestService requestService)
    {
        _requestService = requestService;
    }

    [HttpGet]
    public async Task<ActionResult<MaintenanceRequestListResponseDto>> GetRequests(
        [FromQuery] int? propertyId,
        [FromQuery] int? buildingId,
        [FromQuery] int? unitId,
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] string? category,
        [FromQuery] int? assignedToUserId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _requestService.GetManagementRequestsAsync(
            propertyId,
            buildingId,
            unitId,
            status,
            priority,
            category,
            assignedToUserId,
            search,
            page,
            pageSize,
            GetCurrentUserId(),
            IsAdmin());

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> GetRequestById(int id)
    {
        var result = await _requestService.GetManagementRequestByIdAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/assign")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> AssignTechnician(int id, [FromBody] MaintenanceRequestAssignDto dto)
    {
        var result = await _requestService.AssignTechnicianAsync(id, dto.AssignedToUserId, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPut("{id:int}/priority")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> UpdatePriority(int id, [FromBody] MaintenanceRequestPriorityUpdateDto dto)
    {
        var result = await _requestService.UpdatePriorityAsync(id, dto.Priority, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> UpdateStatus(int id, [FromBody] MaintenanceRequestStatusUpdateDto dto)
    {
        var result = await _requestService.UpdateStatusAsync(id, dto.NewStatus, dto.Note, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/notes")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> AddWorkNote(int id, [FromBody] MaintenanceRequestNoteDto dto)
    {
        var result = await _requestService.AddWorkNoteAsync(id, dto.Note, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpGet("{id:int}/attachments/{attachmentId:int}")]
    public async Task<IActionResult> DownloadAttachment(int id, int attachmentId)
    {
        var (stream, contentType, fileName) = await _requestService.GetAttachmentStreamAsync(id, attachmentId, GetCurrentUserId(), IsAdmin());
        return File(stream, contentType, fileName);
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
}
