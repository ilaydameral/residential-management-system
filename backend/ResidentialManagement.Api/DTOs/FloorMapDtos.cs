namespace ResidentialManagement.Api.DTOs;

public class BuildingFloorMapDto
{
    public int BuildingId { get; set; }
    public string BuildingName { get; set; } = string.Empty;
    public string BuildingCode { get; set; } = string.Empty;
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int TotalFloors { get; set; }
    public int TotalUnits { get; set; }

    public List<FloorMapFloorDto> Floors { get; set; } = new();
}

public class FloorMapFloorDto
{
    public int FloorNumber { get; set; }
    public string FloorLabel { get; set; } = string.Empty;
    public int UnitCount { get; set; }
    public List<FloorMapUnitDto> Units { get; set; } = new();
}

public class FloorMapUnitDto
{
    public int UnitId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public int FloorNumber { get; set; }
    public string UnitTypeName { get; set; } = string.Empty;
    public bool IsActive { get; set; }

    // Occupancy Summary
    public string OccupancyStatus { get; set; } = string.Empty; // "VACANT", "OCCUPIED_OWNER", "OCCUPIED_TENANT"
    public string? PrimaryResidentName { get; set; }
    public int ActiveResidentCount { get; set; }

    // Finance Summary
    public decimal OutstandingBalance { get; set; }
    public bool HasOverdueDebt { get; set; }

    // Maintenance Summary
    public int OpenMaintenanceRequestCount { get; set; }
    public bool HasEmergencyMaintenanceRequest { get; set; }
    public string MaintenanceStatus { get; set; } = "NONE"; // "NONE", "LOW", "NORMAL", "HIGH", "EMERGENCY"
}
