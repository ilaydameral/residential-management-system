using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class Payment
{
    public int Id { get; set; }

    public int UnitChargeId { get; set; }
    public UnitCharge UnitCharge { get; set; } = null!;

    public int? PaymentSubmissionId { get; set; }
    public PaymentSubmission? PaymentSubmission { get; set; }

    public int? PayerUserId { get; set; }
    public User? PayerUser { get; set; }

    public decimal Amount { get; set; }

    public DateTime PaymentDate { get; set; }

    [MaxLength(50)]
    public string PaymentMethod { get; set; } = "BANK_TRANSFER";

    [MaxLength(100)]
    public string? TransactionReference { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public bool IsCancelled { get; set; } = false;

    public DateTime? CancelledAt { get; set; }

    public int? CancelledByUserId { get; set; }
    public User? CancelledByUser { get; set; }

    [MaxLength(500)]
    public string? CancelReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;
}
