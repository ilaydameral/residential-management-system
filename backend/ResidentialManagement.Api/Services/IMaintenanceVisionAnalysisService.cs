using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IMaintenanceVisionAnalysisService
{
    Task<MaintenanceImageAnalysisDto> AnalyzeAsync(
        MaintenanceImageAnalysisRequestDto request,
        CancellationToken cancellationToken);
}
