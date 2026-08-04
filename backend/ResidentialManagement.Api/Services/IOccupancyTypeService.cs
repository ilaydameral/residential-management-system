using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IOccupancyTypeService
{
    Task<List<OccupancyTypeDto>> GetActiveAsync();
}
