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

    public async Task PublishMaintenanceRequestUpdatedAsync(MaintenanceRequestUpdatedEvent evt, IEnumerable<int> targetUserIds)
    {
        // 1. Send to all ADMIN connections
        await _hubContext.Clients.Group("role:ADMIN").SendAsync("MaintenanceRequestUpdated", evt);

        // 2. Send to targeted user groups (scoped managers, request owner, assigned technician, previous technician)
        var distinctUserIds = targetUserIds.Distinct().Where(id => id > 0).ToList();
        foreach (var userId in distinctUserIds)
        {
            await _hubContext.Clients.Group($"user:{userId}").SendAsync("MaintenanceRequestUpdated", evt);
        }
    }

    public async Task PublishActivityFeedInvalidatedAsync(string category)
    {
        var evt = new ActivityFeedInvalidatedEvent { Category = category };
        await _hubContext.Clients.Group("role:ADMIN").SendAsync("ActivityFeedInvalidated", evt);
        await _hubContext.Clients.Group("role:MANAGER").SendAsync("ActivityFeedInvalidated", evt);
    }

    public async Task PublishFacilityReservationUpdatedAsync(FacilityReservationUpdatedEvent evt, IEnumerable<int> targetUserIds)
    {
        await _hubContext.Clients.Group("role:ADMIN").SendAsync("FacilityReservationUpdated", evt);
        var distinctUserIds = targetUserIds.Distinct().Where(id => id > 0).ToList();
        foreach (var userId in distinctUserIds)
        {
            await _hubContext.Clients.Group($"user:{userId}").SendAsync("FacilityReservationUpdated", evt);
        }
    }

    public async Task PublishFacilityAvailabilityInvalidatedAsync(int facilityId, string date)
    {
        var evt = new FacilityAvailabilityInvalidatedEvent { FacilityId = facilityId, Date = date };
        await _hubContext.Clients.All.SendAsync("FacilityAvailabilityInvalidated", evt);
    }
}
