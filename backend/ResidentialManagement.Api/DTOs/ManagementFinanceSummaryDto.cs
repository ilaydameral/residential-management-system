namespace ResidentialManagement.Api.DTOs;

public class ManagementFinanceSummaryDto
{
    public decimal TotalCharged { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalOutstanding { get; set; }
    public decimal OverdueAmount { get; set; }
    public int PendingSubmissionCount { get; set; }
    public int TotalUnitsCount { get; set; }
    public int OverdueUnitCount { get; set; }
}
