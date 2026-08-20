using Microsoft.AspNetCore.SignalR;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Hubs;

namespace ResidentialManagement.Api.Services;

public class RealtimePublisher : IRealtimePublisher
{
    private readonly IHubContext<RealtimeHub> _hubContext;

    public RealtimePublisher(IHubContext<RealtimeHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendToUserAsync<T>(int userId, string eventName, T data)
    {
        await _hubContext.Clients.Group($"user:{userId}").SendAsync(eventName, data);
    }

    public async Task SendToGroupAsync<T>(string groupName, string eventName, T data)
    {
        await _hubContext.Clients.Group(groupName).SendAsync(eventName, data);
    }

    public async Task PublishNotificationCreatedAsync(NotificationDto notification)
    {
        var evt = new NotificationCreatedEvent { Notification = notification };
        await _hubContext.Clients.Group($"user:{notification.UserId}").SendAsync("NotificationCreated", evt);
    }

    public async Task PublishNotificationsAsync(IEnumerable<NotificationDto> notifications)
    {
        foreach (var notification in notifications)
        {
            await PublishNotificationCreatedAsync(notification);
        }
    }

    public async Task PublishUserScopeInvalidatedAsync(int userId, string reason = "SCOPE_CHANGED")
    {
        var evt = new UserScopeInvalidatedEvent { UserId = userId, Reason = reason };
        await _hubContext.Clients.Group($"user:{userId}").SendAsync("UserScopeInvalidated", evt);
    }
}
