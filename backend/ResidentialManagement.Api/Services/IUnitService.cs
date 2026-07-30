using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IUnitService
{
    Task<List<UnitDto>> GetAllUnitsAsync(bool includeInactive = false);
    Task<UnitDto?> GetUnitByIdAsync(int id);
    Task<List<UnitDto>?> GetUnitsByBuildingIdAsync(int buildingId, bool includeInactive = false);
    Task<List<UnitDto>?> GetUnitsByPropertyIdAsync(int propertyId, bool includeInactive = false);
    Task<UnitDto> CreateUnitAsync(CreateUnitDto createDto);
    Task<UnitDto?> UpdateUnitAsync(int id, UpdateUnitDto updateDto);
    Task<bool> DeleteUnitAsync(int id);
}
