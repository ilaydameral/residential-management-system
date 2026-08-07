namespace ResidentialManagement.Api.DTOs;

public class PaymentSubmissionDto
{
    public int Id { get; set; }
    public int UnitChargeId { get; set; }
    public string UnitChargeTitle { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public string BuildingName { get; set; } = string.Empty;
    public string PropertyName { get; set; } = string.Empty;
    public int SubmittedByUserId { get; set; }
    public string SubmittedByFullName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string? ReferenceCode { get; set; }
    public string? ReceiptAttachmentUrl { get; set; }
    public string? UserNotes { get; set; }
    public string Status { get; set; } = string.Empty; // PENDING, APPROVED, REJECTED, CANCELLED
    public int? ReviewedByUserId { get; set; }
    public string? ReviewedByFullName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelledByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
}
