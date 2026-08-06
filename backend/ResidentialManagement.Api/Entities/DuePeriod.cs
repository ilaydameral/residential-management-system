using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class DuePeriod
{
    public int Id { get; set; }

    public int DueDefinitionId { get; set; }
    public DueDefinition DueDefinition { get; set; } = null!;

    public int Year { get; set; }
    public int Month { get; set; }

    [MaxLength(50)]
    public string PeriodName { get; set; } = string.Empty;

    public DateTime DueDate { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "DRAFT";

    public DateTime? IssuedAt { get; set; }

    public int? IssuedByUserId { get; set; }
    public User? IssuedByUser { get; set; }

    public DateTime? CancelledAt { get; set; }

    public int? CancelledByUserId { get; set; }
    public User? CancelledByUser { get; set; }

    [MaxLength(500)]
    public string? CancellationReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<UnitCharge> UnitCharges { get; set; } = new List<UnitCharge>();
}
