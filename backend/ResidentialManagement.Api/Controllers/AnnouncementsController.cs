using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/announcements")]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
public class AnnouncementsController : ControllerBase
{
    private readonly IAnnouncementService _announcementService;

    public AnnouncementsController(IAnnouncementService announcementService)
    {
        _announcementService = announcementService;
    }

    [HttpGet]
    public async Task<ActionResult<AnnouncementListResponseDto>> GetAnnouncements(
        [FromQuery] int? propertyId,
        [FromQuery] int? buildingId,
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _announcementService.GetManagementAnnouncementsAsync(
            propertyId,
            buildingId,
            status,
            priority,
            search,
            page,
            pageSize,
            GetCurrentUserId(),
            IsAdmin());

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AnnouncementDetailDto>> GetAnnouncementById(int id)
    {
        var result = await _announcementService.GetManagementAnnouncementByIdAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<AnnouncementDetailDto>> CreateDraft([FromBody] AnnouncementCreateDto dto)
    {
        var result = await _announcementService.CreateDraftAnnouncementAsync(dto, GetCurrentUserId(), IsAdmin());
        return CreatedAtAction(nameof(GetAnnouncementById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AnnouncementDetailDto>> Update(int id, [FromBody] AnnouncementUpdateDto dto)
    {
        var result = await _announcementService.UpdateAnnouncementAsync(id, dto, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/publish")]
    public async Task<ActionResult<AnnouncementDetailDto>> Publish(int id)
    {
        var result = await _announcementService.PublishAnnouncementAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<AnnouncementDetailDto>> Cancel(int id)
    {
        var result = await _announcementService.CancelAnnouncementAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
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
