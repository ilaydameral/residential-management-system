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
