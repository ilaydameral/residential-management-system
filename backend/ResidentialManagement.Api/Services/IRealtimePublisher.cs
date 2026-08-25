using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IRealtimePublisher
{
    Task SendToUserAsync<T>(int userId, string eventName, T data);
    Task SendToGroupAsync<T>(string groupName, string eventName, T data);
    Task PublishNotificationCreatedAsync(NotificationDto notification);
    Task PublishNotificationsAsync(IEnumerable<NotificationDto> notifications);
    Task PublishUserScopeInvalidatedAsync(int userId, string reason = "SCOPE_CHANGED");
    Task PublishMaintenanceRequestUpdatedAsync(MaintenanceRequestUpdatedEvent evt, IEnumerable<int> targetUserIds);
    Task PublishActivityFeedInvalidatedAsync(string category);
    Task PublishFacilityReservationUpdatedAsync(FacilityReservationUpdatedEvent evt, IEnumerable<int> targetUserIds);
    Task PublishFacilityAvailabilityInvalidatedAsync(int facilityId, string date);
    Task PublishVisitorStatusChangedAsync(VisitorStatusChangedEvent evt, IEnumerable<int> targetUserIds);
}
