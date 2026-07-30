namespace ResidentialManagement.Api.DTOs;

public class UnitDto
{
    public int Id { get; set; }

    public int BuildingId { get; set; }

    public string BuildingName { get; set; } = string.Empty;

    public int PropertyId { get; set; }

    public string PropertyName { get; set; } = string.Empty;

    public int UnitTypeId { get; set; }

    public string UnitTypeName { get; set; } = string.Empty;

    public string UnitTypeCode { get; set; } = string.Empty;

    public string UnitNumber { get; set; } = string.Empty;

    public int FloorNumber { get; set; }

    public decimal? GrossArea { get; set; }

    public decimal? NetArea { get; set; }

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
