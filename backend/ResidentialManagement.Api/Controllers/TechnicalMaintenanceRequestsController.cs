using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/technical/maintenance-requests")]
[Authorize(Roles = AppRoles.TechnicalStaff)]
public class TechnicalMaintenanceRequestsController : ControllerBase
{
    private readonly IMaintenanceRequestService _requestService;

    public TechnicalMaintenanceRequestsController(IMaintenanceRequestService requestService)
    {
        _requestService = requestService;
    }

    [HttpGet]
    public async Task<ActionResult<MaintenanceRequestListResponseDto>> GetMyAssignedRequests(
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] string? category,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _requestService.GetTechnicalRequestsAsync(status, priority, category, page, pageSize, GetCurrentUserId());
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> GetMyAssignedRequestById(int id)
    {
        var result = await _requestService.GetTechnicalRequestByIdAsync(id, GetCurrentUserId());
        return Ok(result);
    }

    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> UpdateStatus(int id, [FromBody] MaintenanceRequestStatusUpdateDto dto)
    {
        var result = await _requestService.UpdateStatusAsync(id, dto.NewStatus, dto.Note, GetCurrentUserId(), false);
        return Ok(result);
    }

    [HttpPost("{id:int}/notes")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> AddWorkNote(int id, [FromBody] MaintenanceRequestNoteDto dto)
    {
        var result = await _requestService.AddWorkNoteAsync(id, dto.Note, GetCurrentUserId(), false);
        return Ok(result);
    }

    [HttpGet("{id:int}/attachments/{attachmentId:int}")]
    public async Task<IActionResult> DownloadAttachment(int id, int attachmentId)
    {
        var (stream, contentType, fileName) = await _requestService.GetAttachmentStreamAsync(id, attachmentId, GetCurrentUserId(), false);
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
}
