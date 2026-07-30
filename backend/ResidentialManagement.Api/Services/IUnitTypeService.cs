using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IUnitTypeService
{
    Task<List<UnitTypeDto>> GetAllUnitTypesAsync(bool includeInactive = false);
    Task<UnitTypeDto?> GetUnitTypeByIdAsync(int id);
    Task<UnitTypeDto> CreateUnitTypeAsync(CreateUnitTypeDto createDto);
    Task<UnitTypeDto?> UpdateUnitTypeAsync(int id, UpdateUnitTypeDto updateDto);
    Task<bool> DeleteUnitTypeAsync(int id);
}
