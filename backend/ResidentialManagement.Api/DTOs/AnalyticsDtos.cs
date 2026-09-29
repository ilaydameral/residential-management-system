namespace ResidentialManagement.Api.DTOs;

public class FinanceAnalyticsDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public decimal TotalCharged { get; set; }
    public decimal TotalCollected { get; set; }
    public decimal OutstandingAmount { get; set; }
    public decimal CollectionRate { get; set; }
    public int OverdueChargeCount { get; set; }
    public decimal OverdueAmount { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal NetCashPosition { get; set; }
    public List<FinanceTrendPointDto> Trend { get; set; } = new();
    public List<AmountBreakdownDto> ExpenseByCategory { get; set; } = new();
    public List<BuildingAmountBreakdownDto> OutstandingByBuilding { get; set; } = new();
}

public class FinanceTrendPointDto
{
    public string Period { get; set; } = string.Empty;
    public decimal Charged { get; set; }
    public decimal Collected { get; set; }
}

public class AmountBreakdownDto
{
    public string Key { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class BuildingAmountBreakdownDto
{
    public int BuildingId { get; set; }
    public string BuildingName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class MaintenanceAnalyticsDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalRequests { get; set; }
    public int OpenBacklog { get; set; }
    public int InProgress { get; set; }
    public int ResolvedOrClosed { get; set; }
    public int HighOrEmergency { get; set; }
    public decimal? AverageResolutionHours { get; set; }
    public List<CountBreakdownDto> ByCategory { get; set; } = new();
    public List<CountBreakdownDto> ByStatus { get; set; } = new();
    public List<CountTrendPointDto> Trend { get; set; } = new();
    public List<BuildingCountBreakdownDto> TopBuildings { get; set; } = new();
}

public class CountBreakdownDto
{
    public string Key { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class CountTrendPointDto
{
    public string Period { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class BuildingCountBreakdownDto
{
    public int BuildingId { get; set; }
    public string BuildingName { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class FacilityAnalyticsDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalReservations { get; set; }
    public int ApprovedOrCompleted { get; set; }
    public int Pending { get; set; }
    public int CancelledOrRejected { get; set; }
    public decimal BookedHours { get; set; }
    public List<FacilityUsageBreakdownDto> ByFacility { get; set; } = new();
    public List<CountBreakdownDto> ByStatus { get; set; } = new();
    public List<CountTrendPointDto> Trend { get; set; } = new();
}

public class FacilityUsageBreakdownDto
{
    public int FacilityId { get; set; }
    public string FacilityName { get; set; } = string.Empty;
    public int ReservationCount { get; set; }
    public decimal BookedHours { get; set; }
}
