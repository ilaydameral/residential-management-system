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

    public AiController(IAiAssistantService aiAssistantService)
    {
        _aiAssistantService = aiAssistantService;
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
