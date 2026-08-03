using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IUnitOccupancyService
{
    Task<List<UnitOccupancyDto>> GetAllAsync();
    Task<List<UnitOccupancyDto>?> GetByUnitIdAsync(int unitId, bool includeInactive = false);
    Task<UnitOccupancyDto?> GetByIdAsync(int id);
    Task<UnitOccupancyDto> CreateAsync(int unitId, CreateUnitOccupancyDto createDto);
    Task<UnitOccupancyDto?> UpdateAsync(int id, UpdateUnitOccupancyDto updateDto);
    Task<UnitOccupancyDto?> EndAsync(int id, EndUnitOccupancyDto endDto);
}
