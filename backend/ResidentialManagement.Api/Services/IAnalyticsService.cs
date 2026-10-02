using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IAnalyticsService
{
    Task<FinanceAnalyticsDto> GetFinanceAsync(
        int userId, bool isAdmin, int? propertyId, int? buildingId, DateTime? fromDate, DateTime? toDate);

    Task<MaintenanceAnalyticsDto> GetMaintenanceAsync(
        int userId, bool isAdmin, int? propertyId, int? buildingId, DateTime? fromDate, DateTime? toDate);

    Task<FacilityAnalyticsDto> GetFacilitiesAsync(
        int userId, bool isAdmin, int? propertyId, int? buildingId, DateTime? fromDate, DateTime? toDate);
}
