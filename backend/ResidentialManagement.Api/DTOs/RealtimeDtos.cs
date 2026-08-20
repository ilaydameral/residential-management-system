namespace ResidentialManagement.Api.DTOs;

public class NotificationCreatedEvent
{
    public NotificationDto Notification { get; set; } = null!;
}

public class UserScopeInvalidatedEvent
{
    public int UserId { get; set; }
    public string Reason { get; set; } = "SCOPE_CHANGED";
}

public class MaintenanceRequestUpdatedEvent
{
    public int RequestId { get; set; }
    public int PropertyId { get; set; }
    public int BuildingId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public string? OldStatus { get; set; }
    public string? NewStatus { get; set; }
    public int? AssignedToUserId { get; set; }
    public int? OldAssignedToUserId { get; set; }
    public int UpdatedByUserId { get; set; }
}

public class ActivityFeedInvalidatedEvent
{
    public string Category { get; set; } = string.Empty;
    public string OccurredAt { get; set; } = DateTime.UtcNow.ToString("o");
}
