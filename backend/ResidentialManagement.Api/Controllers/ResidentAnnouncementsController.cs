using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/resident/announcements")]
[Authorize(Roles = AppRoles.Resident)]
public class ResidentAnnouncementsController : ControllerBase
{
    private readonly IAnnouncementService _announcementService;

    public ResidentAnnouncementsController(IAnnouncementService announcementService)
    {
        _announcementService = announcementService;
    }

    [HttpGet]
    public async Task<ActionResult<AnnouncementListResponseDto>> GetMyAnnouncements(
        [FromQuery] string? priority,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _announcementService.GetResidentAnnouncementsAsync(
            priority,
            search,
            page,
            pageSize,
            GetCurrentUserId());

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AnnouncementDetailDto>> GetMyAnnouncementById(int id)
    {
        var result = await _announcementService.GetResidentAnnouncementByIdAsync(id, GetCurrentUserId());
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
}
