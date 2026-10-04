using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IAiAssistantService
{
    Task<MaintenanceAiSuggestionDto> SuggestMaintenanceAsync(
        MaintenanceAiSuggestionRequestDto request,
        CancellationToken cancellationToken);

    Task<AnalyticsAiInsightDto> GenerateAnalyticsInsightAsync(
        int userId,
        bool isAdmin,
        AnalyticsAiInsightRequestDto request,
        CancellationToken cancellationToken);
}
