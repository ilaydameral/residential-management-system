namespace ResidentialManagement.Api.DTOs;

public class ResidentUnitChargeDto
{
    public int Id { get; set; }
    public int UnitId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public string BuildingName { get; set; } = string.Empty;
    public string PropertyName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public string Status { get; set; } = string.Empty; // CANCELLED, PAID, PARTIALLY_PAID, OVERDUE, UNPAID
    public DateTime DueDate { get; set; }
    public string ChargeType { get; set; } = string.Empty;
    public bool IsCancelled { get; set; }
    public DateTime CreatedAt { get; set; }
}
