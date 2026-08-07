namespace ResidentialManagement.Api.DTOs;

public class IssuePeriodPreviewDto
{
    public int PeriodId { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public int DueDefinitionId { get; set; }
    public string DueDefinitionTitle { get; set; } = string.Empty;
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int? BuildingId { get; set; }
    public string? BuildingName { get; set; }
    public int TargetUnitCount { get; set; }
    public decimal UnitDuesAmount { get; set; }
    public decimal TotalExpectedAmount { get; set; }
    public DateTime DueDate { get; set; }
}
