namespace ResidentialManagement.Api.DTOs;

public class MonthlyCollectionSummaryDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public decimal TotalCharged { get; set; }
    public decimal TotalCollected { get; set; }
    public decimal OutstandingBalance { get; set; }
    public decimal CollectionPercentage { get; set; }
    public decimal CumulativeCollectionPercentage { get; set; }
}
