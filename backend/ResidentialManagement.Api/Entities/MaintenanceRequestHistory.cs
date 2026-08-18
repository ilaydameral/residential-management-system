using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class MaintenanceRequestHistory
{
    public long Id { get; set; }

    public int MaintenanceRequestId { get; set; }
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ActionType { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? OldStatus { get; set; }

    [MaxLength(30)]
    public string? NewStatus { get; set; }

    public int? OldAssignedToUserId { get; set; }
    public User? OldAssignedToUser { get; set; }

    public int? NewAssignedToUserId { get; set; }
    public User? NewAssignedToUser { get; set; }

    [MaxLength(1000)]
    public string? Note { get; set; }

    public int ChangedByUserId { get; set; }
    public User ChangedByUser { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
