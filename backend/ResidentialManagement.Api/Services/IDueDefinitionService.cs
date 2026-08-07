using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IDueDefinitionService
{
    Task<List<DueDefinitionDto>> GetAllAsync(
        int currentUserId,
        bool isAdmin,
        int? propertyId,
        int? buildingId,
        bool? isActive);

    Task<DueDefinitionDto?> GetByIdAsync(
        int id,
        int currentUserId,
        bool isAdmin);

    Task<DueDefinitionDto> CreateAsync(
        CreateDueDefinitionDto createDto,
        int currentUserId,
        bool isAdmin);

    Task<DueDefinitionDto?> UpdateAsync(
        int id,
        UpdateDueDefinitionDto updateDto,
        int currentUserId,
        bool isAdmin);

    Task<DueDefinitionDto?> SetActiveAsync(
        int id,
        bool isActive,
        int currentUserId,
        bool isAdmin);
}
