namespace ResidentialManagement.Api.DTOs;

public class IssuePeriodResultDto
{
    public int PeriodId { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public int GeneratedChargeCount { get; set; }
    public decimal TotalIssuedAmount { get; set; }
}
