using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/resident/maintenance-requests")]
[Authorize(Roles = AppRoles.Resident)]
public class ResidentMaintenanceRequestsController : ControllerBase
{
    private readonly IMaintenanceRequestService _requestService;

    public ResidentMaintenanceRequestsController(IMaintenanceRequestService requestService)
    {
        _requestService = requestService;
    }

    [HttpPost]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> CreateRequest([FromBody] MaintenanceRequestCreateDto dto)
    {
        var result = await _requestService.CreateRequestAsync(dto, GetCurrentUserId());
        return CreatedAtAction(nameof(GetMyRequestById), new { id = result.Id }, result);
    }

    [HttpGet]
    public async Task<ActionResult<MaintenanceRequestListResponseDto>> GetMyRequests(
        [FromQuery] string? status,
        [FromQuery] string? category,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _requestService.GetResidentRequestsAsync(status, category, page, pageSize, GetCurrentUserId());
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> GetMyRequestById(int id)
    {
        var result = await _requestService.GetResidentRequestByIdAsync(id, GetCurrentUserId());
        return Ok(result);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> CancelMyRequest(int id)
    {
        var result = await _requestService.CancelResidentRequestAsync(id, GetCurrentUserId());
        return Ok(result);
    }

    [HttpPost("{id:int}/resolve-action")]
    public async Task<ActionResult<MaintenanceRequestDetailDto>> ResolveAction(int id, [FromBody] MaintenanceRequestStatusUpdateDto dto)
    {
        var result = await _requestService.UpdateResidentResolvedRequestStatusAsync(id, dto.NewStatus, dto.Note, GetCurrentUserId());
        return Ok(result);
    }

    [HttpPost("{id:int}/attachments")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<MaintenanceRequestAttachmentDto>> UploadAttachment(int id, IFormFile file)
    {
        if (file is null || file.Length == 0)
        {
            throw new BadRequestException("Lütfen yüklenecek dosyayı seçin.");
        }

        using var stream = file.OpenReadStream();
        var result = await _requestService.AddAttachmentAsync(
            id,
            stream,
            file.FileName,
            file.ContentType ?? "application/octet-stream",
            GetCurrentUserId(),
            false);

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
