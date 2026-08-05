using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IUnitService
{
    Task<List<UnitDto>> GetAllUnitsAsync(
        bool includeInactive = false,
        int? residentUserId = null,
        IReadOnlyCollection<int>? accessibleBuildingIds = null);
    Task<UnitDto?> GetUnitByIdAsync(int id, int? residentUserId = null);
    Task<List<UnitDto>?> GetUnitsByBuildingIdAsync(
        int buildingId,
        bool includeInactive = false,
        int? residentUserId = null,
        IReadOnlyCollection<int>? accessibleBuildingIds = null);
    Task<List<UnitDto>?> GetUnitsByPropertyIdAsync(
        int propertyId,
        bool includeInactive = false,
        int? residentUserId = null,
        IReadOnlyCollection<int>? accessibleBuildingIds = null);
    Task<List<ResidentUnitDto>> GetResidentUnitsAsync(int residentUserId);
    Task<UnitDto> CreateUnitAsync(CreateUnitDto createDto);
    Task<UnitDto?> UpdateUnitAsync(int id, UpdateUnitDto updateDto);
    Task<bool> DeleteUnitAsync(int id);
}
