using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IPropertyService
{
    Task<List<PropertyDto>> GetAllPropertiesAsync(
        bool includeInactive = false,
        IReadOnlyCollection<int>? accessiblePropertyIds = null,
        IReadOnlyCollection<int>? accessibleBuildingIds = null);
    Task<PropertyDto?> GetPropertyByIdAsync(
        int id,
        IReadOnlyCollection<int>? accessibleBuildingIds = null);
    Task<PropertyDto> CreatePropertyAsync(CreatePropertyDto createDto);
    Task<PropertyDto?> UpdatePropertyAsync(int id, UpdatePropertyDto updateDto);
    Task<bool> DeactivatePropertyAsync(int id);
    Task<bool> DeletePropertyAsync(int id);
}
