using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class MaintenanceRequest
{
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string RequestNumber { get; set; } = string.Empty;

    public int UnitId { get; set; }
    public Unit Unit { get; set; } = null!;

    public int PropertyId { get; set; }
    public Property Property { get; set; } = null!;

    public int BuildingId { get; set; }
    public Building Building { get; set; } = null!;

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public int? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }

    [Required]
    [MaxLength(50)]
    public string Category { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string Priority { get; set; } = "NORMAL";

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "OPEN";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    public ICollection<MaintenanceRequestHistory> Histories { get; set; } = new List<MaintenanceRequestHistory>();
    public ICollection<MaintenanceRequestAttachment> Attachments { get; set; } = new List<MaintenanceRequestAttachment>();
}
