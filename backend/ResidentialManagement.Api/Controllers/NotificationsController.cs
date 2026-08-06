using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult<List<NotificationDto>>> GetNotifications([FromQuery] bool includeDismissed = false)
    {
        var notifications = await _notificationService.GetNotificationsAsync(GetCurrentUserId(), includeDismissed);
        return Ok(notifications);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadNotificationCountDto>> GetUnreadCount()
    {
        var count = await _notificationService.GetUnreadCountAsync(GetCurrentUserId());
        return Ok(count);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<NotificationDto>> GetById(int id)
    {
        var notification = await _notificationService.GetNotificationByIdAsync(id, GetCurrentUserId());
        return notification is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(notification);
    }

    [HttpPost("{id:int}/read")]
    public async Task<ActionResult<NotificationDto>> MarkAsRead(int id)
    {
        var notification = await _notificationService.MarkAsReadAsync(id, GetCurrentUserId());
        return notification is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(notification);
    }

    [HttpPost("read-all")]
    public async Task<ActionResult<object>> MarkAllAsRead()
    {
        var updatedCount = await _notificationService.MarkAllAsReadAsync(GetCurrentUserId());
        return Ok(new { updatedCount });
    }

    [HttpPost("{id:int}/dismiss")]
    public async Task<ActionResult<NotificationDto>> Dismiss(int id)
    {
        var notification = await _notificationService.DismissAsync(id, GetCurrentUserId());
        return notification is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(notification);
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
            Message = $"ID'si {id} olan bildirim bulunamadı.",
            Timestamp = DateTime.UtcNow
        };
    }
}
