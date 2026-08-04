using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IDashboardService
{
    Task<DashboardSummaryDto> GetSummaryAsync();
}
