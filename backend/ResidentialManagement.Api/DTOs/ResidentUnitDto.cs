namespace ResidentialManagement.Api.DTOs;

public class ResidentUnitDto
{
    public int UnitId { get; set; }

    public string PropertyName { get; set; } = string.Empty;

    public string BuildingName { get; set; } = string.Empty;

    public string UnitNumber { get; set; } = string.Empty;

    public int FloorNumber { get; set; }

    public string OccupancyType { get; set; } = string.Empty;

    public bool IsPrimary { get; set; }

    public DateTime StartDate { get; set; }
}
