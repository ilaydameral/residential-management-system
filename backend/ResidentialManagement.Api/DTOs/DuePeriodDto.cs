namespace ResidentialManagement.Api.DTOs;

public class DuePeriodDto
{
    public int Id { get; set; }
    public int DueDefinitionId { get; set; }
    public string DueDefinitionTitle { get; set; } = string.Empty;
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int? BuildingId { get; set; }
    public string? BuildingName { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public decimal UnitAmount { get; set; }
    public DateTime DueDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? IssuedAt { get; set; }
    public string? IssuedByFullName { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelledByFullName { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedByFullName { get; set; } = string.Empty;
}
