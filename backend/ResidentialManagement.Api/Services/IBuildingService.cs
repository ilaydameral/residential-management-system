using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IBuildingService
{
    Task<List<BuildingDto>> GetAllBuildingsAsync(bool includeInactive = false);
    Task<BuildingDto?> GetBuildingByIdAsync(int id);
    Task<List<BuildingDto>?> GetBuildingsByPropertyIdAsync(int propertyId, bool includeInactive = false);
    Task<BuildingDto> CreateBuildingAsync(CreateBuildingDto createDto);
    Task<BuildingDto?> UpdateBuildingAsync(int id, UpdateBuildingDto updateDto);
    Task<bool> DeleteBuildingAsync(int id);
}
