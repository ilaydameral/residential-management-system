namespace ResidentialManagement.Api.DTOs;

public class DuePeriodCollectionSummaryDto
{
    public int DuePeriodId { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
    public int TotalUnitCount { get; set; }
    public decimal TotalAssessedAmount { get; set; }
    public decimal TotalCollectedAmount { get; set; }
    public decimal TotalOutstandingAmount { get; set; }
    public int PaidUnitCount { get; set; }
    public int PartiallyPaidUnitCount { get; set; }
    public int UnpaidUnitCount { get; set; }
    public int OverdueUnitCount { get; set; }
    public int PendingSubmissionUnitCount { get; set; }
}

public class DuePeriodUnitCollectionItemDto
{
    public int UnitChargeId { get; set; }
    public int UnitId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public string BuildingName { get; set; } = string.Empty;
    public string PropertyName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public decimal PendingSubmissionAmount { get; set; }
    public bool HasPendingSubmission { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
}

public class DuePeriodCollectionDetailsDto
{
    public DuePeriodCollectionSummaryDto Summary { get; set; } = new();
    public List<DuePeriodUnitCollectionItemDto> Units { get; set; } = new();
}
