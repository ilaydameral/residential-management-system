using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IFinancialReportingService
{
    Task<ManagementFinanceSummaryDto> GetManagementSummaryAsync(int currentUserId, bool isAdmin);
    Task<List<MonthlyCollectionSummaryDto>> GetManagementMonthlyCollectionsAsync(int currentUserId, bool isAdmin);
    Task<List<UnitOutstandingReportDto>> GetHighestOutstandingUnitsAsync(int currentUserId, bool isAdmin, int count = 10);
    Task<ResidentFinanceSummaryDto> GetResidentSummaryAsync(int residentUserId);
}
