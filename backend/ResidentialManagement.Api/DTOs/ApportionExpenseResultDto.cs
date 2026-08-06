namespace ResidentialManagement.Api.DTOs;

public class ApportionExpenseResultDto
{
    public int ExpenseId { get; set; }
    public string ExpenseTitle { get; set; } = string.Empty;
    public DateTime ApportionedAt { get; set; }
    public int GeneratedChargeCount { get; set; }
    public decimal TotalApportionedAmount { get; set; }
}
