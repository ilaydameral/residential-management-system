using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IPropertyService
{
    Task<List<PropertyDto>> GetAllPropertiesAsync();
    Task<PropertyDto?> GetPropertyByIdAsync(int id);
    Task<PropertyDto> CreatePropertyAsync(CreatePropertyDto createDto);
    Task<PropertyDto?> UpdatePropertyAsync(int id, UpdatePropertyDto updateDto);
    Task<bool> DeactivatePropertyAsync(int id);
}
