namespace ResidentialManagement.Api.DTOs;

public class UnitOccupancyDto
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string UserName { get; set; } = string.Empty;

    public string UserFullName { get; set; } = string.Empty;

    public string UserEmail { get; set; } = string.Empty;

    public int UnitId { get; set; }

    public string UnitNumber { get; set; } = string.Empty;

    public int BuildingId { get; set; }

    public string BuildingName { get; set; } = string.Empty;

    public int PropertyId { get; set; }

    public string PropertyName { get; set; } = string.Empty;

    public int OccupancyTypeId { get; set; }

    public string OccupancyTypeCode { get; set; } = string.Empty;

    public string OccupancyTypeName { get; set; } = string.Empty;

    public DateTime StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public bool IsActive { get; set; }

    public bool IsPrimary { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
