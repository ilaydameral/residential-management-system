using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class Expense
{
    public int Id { get; set; }

    public int PropertyId { get; set; }
    public Property Property { get; set; } = null!;

    public int? BuildingId { get; set; }
    public Building? Building { get; set; }

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Category { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public DateTime ExpenseDate { get; set; }

    [MaxLength(100)]
    public string? DocumentNumber { get; set; }

    [MaxLength(150)]
    public string? VendorName { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(500)]
    public string? AttachmentUrl { get; set; }

    public bool IsCancelled { get; set; } = false;

    public DateTime? CancelledAt { get; set; }

    public int? CancelledByUserId { get; set; }
    public User? CancelledByUser { get; set; }

    [MaxLength(500)]
    public string? CancelReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public DateTime? UpdatedAt { get; set; }

    public int? UpdatedByUserId { get; set; }
    public User? UpdatedByUser { get; set; }

    public ICollection<UnitCharge> UnitCharges { get; set; } = new List<UnitCharge>();
}
