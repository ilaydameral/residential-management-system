using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IDuePeriodService
{
    Task<List<DuePeriodDto>> GetAllAsync(
        int currentUserId,
        bool isAdmin,
        int? dueDefinitionId,
        int? year,
        int? month,
        string? status);

    Task<DuePeriodDto?> GetByIdAsync(
        int id,
        int currentUserId,
        bool isAdmin);

    Task<DuePeriodDto> CreateDraftPeriodAsync(
        CreateDraftDuePeriodDto createDto,
        int currentUserId,
        bool isAdmin);

    Task<IssuePeriodPreviewDto> GetIssuePreviewAsync(
        int periodId,
        int currentUserId,
        bool isAdmin);

    Task<IssuePeriodResultDto> IssuePeriodAsync(
        int periodId,
        int currentUserId,
        bool isAdmin);

    Task<DuePeriodDto?> CancelDraftPeriodAsync(
        int periodId,
        CancelDuePeriodDto cancelDto,
        int currentUserId,
        bool isAdmin);
}
