using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class ManagerAssignment
{
    public int Id { get; set; }

    public int ManagerUserId { get; set; }
    public User ManagerUser { get; set; } = null!;

    public int PropertyId { get; set; }
    public Property Property { get; set; } = null!;

    public int? BuildingId { get; set; }
    public Building? Building { get; set; }

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    public int AssignedByUserId { get; set; }
    public User AssignedByUser { get; set; } = null!;

    public bool IsActive { get; set; } = true;

    public DateTime? EndedAt { get; set; }

    public int? EndedByUserId { get; set; }
    public User? EndedByUser { get; set; }

    [MaxLength(500)]
    public string? EndReason { get; set; }
}
