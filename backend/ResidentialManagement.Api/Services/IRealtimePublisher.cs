using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IRealtimePublisher
{
    Task SendToUserAsync<T>(int userId, string eventName, T data);
    Task SendToGroupAsync<T>(string groupName, string eventName, T data);
    Task PublishNotificationCreatedAsync(NotificationDto notification);
    Task PublishNotificationsAsync(IEnumerable<NotificationDto> notifications);
    Task PublishUserScopeInvalidatedAsync(int userId, string reason = "SCOPE_CHANGED");
}
