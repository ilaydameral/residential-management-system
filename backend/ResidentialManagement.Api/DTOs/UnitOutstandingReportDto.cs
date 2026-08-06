namespace ResidentialManagement.Api.DTOs;

public class UnitOutstandingReportDto
{
    public int UnitId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public string BuildingName { get; set; } = string.Empty;
    public string PropertyName { get; set; } = string.Empty;
    public decimal TotalCharged { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal RemainingBalance { get; set; }
    public int OverdueChargeCount { get; set; }
}
