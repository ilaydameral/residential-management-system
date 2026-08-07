using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class UnitCharge
{
    public int Id { get; set; }

    public int UnitId { get; set; }
    public Unit Unit { get; set; } = null!;

    public int? DuePeriodId { get; set; }
    public DuePeriod? DuePeriod { get; set; }

    public int? ExpenseId { get; set; }
    public Expense? Expense { get; set; }

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public decimal Amount { get; set; }

    public DateTime DueDate { get; set; }

    [MaxLength(50)]
    public string ChargeType { get; set; } = "DUES";

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

    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<PaymentSubmission> PaymentSubmissions { get; set; } = new List<PaymentSubmission>();
}
