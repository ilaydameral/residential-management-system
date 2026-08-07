namespace ResidentialManagement.Api.DTOs;

public class ExpenseDto
{
    public int Id { get; set; }
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int? BuildingId { get; set; }
    public string? BuildingName { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime ExpenseDate { get; set; }
    public string? DocumentNumber { get; set; }
    public string? VendorName { get; set; }
    public string? Description { get; set; }
    public string? AttachmentUrl { get; set; }
    public bool IsCancelled { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelledByFullName { get; set; }
    public string? CancelReason { get; set; }
    public bool IsApportioned { get; set; }
    public int ApportionedChargeCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedByFullName { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByFullName { get; set; }
}
