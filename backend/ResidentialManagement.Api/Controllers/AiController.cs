using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public sealed class AiController : ControllerBase
{
    private readonly IAiAssistantService _aiAssistantService;
    private readonly IMaintenanceVisionAnalysisService _maintenanceVisionAnalysisService;

    public AiController(
        IAiAssistantService aiAssistantService,
        IMaintenanceVisionAnalysisService maintenanceVisionAnalysisService)
    {
        _aiAssistantService = aiAssistantService;
        _maintenanceVisionAnalysisService = maintenanceVisionAnalysisService;
    }

    [HttpPost("maintenance/suggest")]
    [Authorize(Roles = AppRoles.Resident)]
    public async Task<ActionResult<MaintenanceAiSuggestionDto>> SuggestMaintenance(
        [FromBody] MaintenanceAiSuggestionRequestDto request,
        CancellationToken cancellationToken)
        => Ok(await _aiAssistantService.SuggestMaintenanceAsync(request, cancellationToken));

    [HttpPost("maintenance/improve-description")]
    [Authorize(Roles = AppRoles.Resident)]
    public async Task<ActionResult<MaintenanceDescriptionImprovementDto>> ImproveMaintenanceDescription(
        [FromBody] MaintenanceDescriptionImprovementRequestDto request,
        CancellationToken cancellationToken)
        => Ok(await _aiAssistantService.ImproveMaintenanceDescriptionAsync(request, cancellationToken));

    [HttpPost("announcements/improve")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<AnnouncementTextImprovementDto>> ImproveAnnouncementText(
        [FromBody] AnnouncementTextImprovementRequestDto request,
        CancellationToken cancellationToken)
        => Ok(await _aiAssistantService.ImproveAnnouncementTextAsync(request, cancellationToken));

    [HttpPost("maintenance/analyze-image")]
    [Authorize(Roles = AppRoles.Resident)]
    [Consumes("multipart/form-data")]
    // Multipart framing needs a small allowance; the image itself remains capped at 5 MB by the validator.
    [RequestSizeLimit(MaintenanceImageValidator.MaximumFileSizeBytes + 1024 * 1024)]
    public async Task<ActionResult<MaintenanceImageAnalysisDto>> AnalyzeMaintenanceImage(
        [FromForm] MaintenanceImageAnalysisRequestDto request,
        CancellationToken cancellationToken)
        => Ok(await _maintenanceVisionAnalysisService.AnalyzeAsync(request, cancellationToken));

    [HttpPost("analytics/insight")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<AnalyticsAiInsightDto>> GenerateAnalyticsInsight(
        [FromBody] AnalyticsAiInsightRequestDto request,
        CancellationToken cancellationToken)
        => Ok(await _aiAssistantService.GenerateAnalyticsInsightAsync(
            CurrentUserId(), User.IsInRole(AppRoles.Admin), request, cancellationToken));

    private int CurrentUserId()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
        {
            throw new UnauthorizedException("Oturum kullanıcı bilgisi doğrulanamadı.");
        }

        return id;
    }
}
