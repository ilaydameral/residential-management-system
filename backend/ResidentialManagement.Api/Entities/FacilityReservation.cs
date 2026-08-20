using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class FacilityReservation
{
    public long Id { get; set; }

    public int FacilityId { get; set; }
    public CommonFacility Facility { get; set; } = null!;

    public int ResidentUserId { get; set; }
    public User ResidentUser { get; set; } = null!;

    public int UnitId { get; set; }
    public Unit Unit { get; set; } = null!;

    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "PENDING";

    [MaxLength(500)]
    public string? Note { get; set; }

    public int? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }

    public DateTime? ReviewedAt { get; set; }

    [MaxLength(500)]
    public string? RejectionReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
