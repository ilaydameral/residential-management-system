using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class Announcement
{
    public int Id { get; set; }

    public int PropertyId { get; set; }
    public Property Property { get; set; } = null!;

    public int? BuildingId { get; set; }
    public Building? Building { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Content { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string Priority { get; set; } = "NORMAL";

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "DRAFT";

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
}
