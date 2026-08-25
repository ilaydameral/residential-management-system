using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IResidentVehicleService
{
    Task<ResidentVehicleDto> CreateVehicleAsync(int residentUserId, CreateResidentVehicleDto dto);
    Task<List<ResidentVehicleDto>> GetResidentVehiclesAsync(int residentUserId);
    Task<ResidentVehicleDto> UpdateResidentVehicleAsync(int residentUserId, long vehicleId, UpdateResidentVehicleDto dto);
    Task<ResidentVehicleDto> SetResidentVehicleStatusAsync(int residentUserId, long vehicleId, bool isActive);

    Task<PagedResidentVehicleResultDto> GetManagementVehiclesAsync(int userId, bool isAdmin, ResidentVehicleFilterDto filter);
}
