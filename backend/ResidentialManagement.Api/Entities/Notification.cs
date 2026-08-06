using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class Notification
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Message { get; set; } = string.Empty;

    [MaxLength(50)]
    public string NotificationType { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? RelatedEntityName { get; set; }

    public int? RelatedEntityId { get; set; }

    public bool IsRead { get; set; } = false;

    public DateTime? ReadAt { get; set; }

    public bool IsDismissed { get; set; } = false;

    public DateTime? DismissedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
