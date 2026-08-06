namespace ResidentialManagement.Api.DTOs;

public class ExpenseApportionmentPreviewItemDto
{
    public int UnitId { get; set; }
    public string BuildingName { get; set; } = string.Empty;
    public string UnitNumber { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class ExpenseApportionmentPreviewDto
{
    public int ExpenseId { get; set; }
    public string ExpenseTitle { get; set; } = string.Empty;
    public decimal ExpenseAmount { get; set; }
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int? BuildingId { get; set; }
    public string? BuildingName { get; set; }
    public string Mode { get; set; } = string.Empty;
    public int TargetUnitCount { get; set; }
    public decimal TotalAllocatedAmount { get; set; }
    public DateTime DueDate { get; set; }
    public List<ExpenseApportionmentPreviewItemDto> Items { get; set; } = new();
}
