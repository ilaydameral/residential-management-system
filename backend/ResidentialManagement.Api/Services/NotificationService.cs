using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class NotificationService : INotificationService
{
    private readonly AppDbContext _context;

    public NotificationService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<NotificationDto>> GetNotificationsAsync(int userId, bool includeDismissed = false)
    {
        var query = _context.Notifications.AsNoTracking()
            .Where(n => n.UserId == userId);

        if (!includeDismissed)
        {
            query = query.Where(n => !n.IsDismissed);
        }

        return await query
            .OrderByDescending(n => n.CreatedAt)
            .Select(ToDtoExpression())
            .ToListAsync();
    }

    public async Task<NotificationDto?> GetNotificationByIdAsync(int id, int userId)
    {
        return await _context.Notifications.AsNoTracking()
            .Where(n => n.Id == id && n.UserId == userId)
            .Select(ToDtoExpression())
            .FirstOrDefaultAsync();
    }

    public async Task<UnreadNotificationCountDto> GetUnreadCountAsync(int userId)
    {
        var count = await _context.Notifications.AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsDismissed && !n.IsRead)
            .CountAsync();

        return new UnreadNotificationCountDto { UnreadCount = count };
    }

    public async Task<NotificationDto?> MarkAsReadAsync(int id, int userId)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification is null)
        {
            return null;
        }

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return ToDto(notification);
    }

    public async Task<int> MarkAllAsReadAsync(int userId)
    {
        var unreadNotifications = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsDismissed && !n.IsRead)
            .ToListAsync();

        if (unreadNotifications.Count == 0)
        {
            return 0;
        }

        var utcNow = DateTime.UtcNow;
        foreach (var notification in unreadNotifications)
        {
            notification.IsRead = true;
            notification.ReadAt = utcNow;
        }

        return await _context.SaveChangesAsync();
    }

    public async Task<NotificationDto?> DismissAsync(int id, int userId)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification is null)
        {
            return null;
        }

        var utcNow = DateTime.UtcNow;
        notification.IsDismissed = true;
        notification.DismissedAt = utcNow;

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = utcNow;
        }

        await _context.SaveChangesAsync();
        return ToDto(notification);
    }

    public async Task<List<Notification>> AddNotificationEntitiesForUsersAsync(
        IEnumerable<int> userIds,
        string title,
        string message,
        string notificationType,
        string? relatedEntityName = null,
        int? relatedEntityId = null,
        string? eventKey = null)
    {
        var addedList = new List<Notification>();
        var distinctUserIds = userIds.Distinct().ToList();
        if (distinctUserIds.Count == 0)
        {
            return addedList;
        }

        var utcNow = DateTime.UtcNow;

        // Fetch existing notifications for de-duplication if related entity is present
        List<int> existingUserIdsWithNotification = new();
        if (!string.IsNullOrWhiteSpace(relatedEntityName) && relatedEntityId.HasValue)
        {
            var query = _context.Notifications.AsNoTracking()
                .Where(n => distinctUserIds.Contains(n.UserId) &&
                            n.NotificationType == notificationType &&
                            n.RelatedEntityName == relatedEntityName &&
                            n.RelatedEntityId == relatedEntityId.Value);

            if (!string.IsNullOrWhiteSpace(eventKey))
            {
                query = query.Where(n => n.EventKey == eventKey);
            }

            existingUserIdsWithNotification = await query
                .Select(n => n.UserId)
                .ToListAsync();
        }

        foreach (var userId in distinctUserIds)
        {
            if (existingUserIdsWithNotification.Contains(userId))
            {
                continue;
            }

            var notification = new Notification
            {
                UserId = userId,
                Title = title,
                Message = message,
                NotificationType = notificationType,
                RelatedEntityName = relatedEntityName,
                RelatedEntityId = relatedEntityId,
                EventKey = eventKey,
                IsRead = false,
                IsDismissed = false,
                CreatedAt = utcNow
            };

            _context.Notifications.Add(notification);
            addedList.Add(notification);
        }

        return addedList;
    }

    public NotificationDto ToDto(Notification n)
    {
        return new NotificationDto
        {
            Id = n.Id,
            UserId = n.UserId,
            Title = n.Title,
            Message = n.Message,
            NotificationType = n.NotificationType,
            RelatedEntityName = n.RelatedEntityName,
            RelatedEntityId = n.RelatedEntityId,
            EventKey = n.EventKey,
            IsRead = n.IsRead,
            ReadAt = n.ReadAt,
            IsDismissed = n.IsDismissed,
            DismissedAt = n.DismissedAt,
            CreatedAt = n.CreatedAt
        };
    }

    private static System.Linq.Expressions.Expression<Func<Notification, NotificationDto>> ToDtoExpression()
    {
        return n => new NotificationDto
        {
            Id = n.Id,
            UserId = n.UserId,
            Title = n.Title,
            Message = n.Message,
            NotificationType = n.NotificationType,
            RelatedEntityName = n.RelatedEntityName,
            RelatedEntityId = n.RelatedEntityId,
            EventKey = n.EventKey,
            IsRead = n.IsRead,
            ReadAt = n.ReadAt,
            IsDismissed = n.IsDismissed,
            DismissedAt = n.DismissedAt,
            CreatedAt = n.CreatedAt
        };
    }
}
