namespace ResidentialManagement.Api.DTOs;

public class ResidentFinanceSummaryDto
{
    public decimal TotalCharged { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalOutstanding { get; set; }
    public int OverdueChargeCount { get; set; }
    public int PendingSubmissionCount { get; set; }
    public int ActiveOccupancyUnitCount { get; set; }
}
