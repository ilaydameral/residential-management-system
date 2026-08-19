namespace ResidentialManagement.Api.DTOs;

public class NotificationDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string NotificationType { get; set; } = string.Empty;
    public string? RelatedEntityName { get; set; }
    public int? RelatedEntityId { get; set; }
    public string? EventKey { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public bool IsDismissed { get; set; }
    public DateTime? DismissedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
