namespace ResidentialManagement.Api.DTOs;

public class DashboardSummaryDto
{
    public int PropertyCount { get; set; }
    public int BuildingCount { get; set; }
    public int UnitCount { get; set; }
    public int ActiveOccupancyCount { get; set; }
    public int OccupiedUnitCount { get; set; }
    public int VacantUnitCount { get; set; }
}
