using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface INotificationService
{
    Task<List<NotificationDto>> GetNotificationsAsync(int userId, bool includeDismissed = false);
    Task<NotificationDto?> GetNotificationByIdAsync(int id, int userId);
    Task<UnreadNotificationCountDto> GetUnreadCountAsync(int userId);
    Task<NotificationDto?> MarkAsReadAsync(int id, int userId);
    Task<int> MarkAllAsReadAsync(int userId);
    Task<NotificationDto?> DismissAsync(int id, int userId);

    // Operational helper method for transactional event triggers (does NOT call SaveChanges/BeginTransaction)
    Task AddNotificationEntitiesForUsersAsync(
        IEnumerable<int> userIds,
        string title,
        string message,
        string notificationType,
        string? relatedEntityName = null,
        int? relatedEntityId = null);
}
