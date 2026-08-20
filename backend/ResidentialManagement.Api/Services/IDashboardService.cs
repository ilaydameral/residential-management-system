using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IDashboardService
{
    Task<DashboardSummaryDto> GetSummaryAsync(
        IReadOnlyCollection<int>? accessiblePropertyIds = null,
        IReadOnlyCollection<int>? accessibleBuildingIds = null);

    Task<List<ActivityFeedItemDto>> GetActivityFeedAsync(int limit, int userId, bool isAdmin);
}
