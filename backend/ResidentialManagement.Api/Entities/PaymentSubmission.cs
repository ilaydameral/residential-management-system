using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class PaymentSubmission
{
    public int Id { get; set; }

    public int UnitChargeId { get; set; }
    public UnitCharge UnitCharge { get; set; } = null!;

    public int SubmittedByUserId { get; set; }
    public User SubmittedByUser { get; set; } = null!;

    public decimal Amount { get; set; }

    public DateTime PaymentDate { get; set; }

    [MaxLength(50)]
    public string PaymentMethod { get; set; } = "BANK_TRANSFER";

    [MaxLength(100)]
    public string? ReferenceCode { get; set; }

    [MaxLength(500)]
    public string? ReceiptAttachmentUrl { get; set; }

    [MaxLength(500)]
    public string? UserNotes { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "PENDING";

    public int? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }

    public DateTime? ReviewedAt { get; set; }

    [MaxLength(500)]
    public string? RejectionReason { get; set; }

    public DateTime? CancelledAt { get; set; }

    public int? CancelledByUserId { get; set; }
    public User? CancelledByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
