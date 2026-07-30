using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IPropertyTypeService
{
    Task<List<PropertyTypeDto>> GetAllPropertyTypesAsync(bool includeInactive = false);
    Task<PropertyTypeDto?> GetPropertyTypeByIdAsync(int id);
    Task<PropertyTypeDto> CreatePropertyTypeAsync(CreatePropertyTypeDto createDto);
    Task<PropertyTypeDto?> UpdatePropertyTypeAsync(int id, UpdatePropertyTypeDto updateDto);
    Task<bool> DeletePropertyTypeAsync(int id);
}
