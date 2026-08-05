using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IManagerAssignmentService
{
    Task<List<ManagerAssignmentDto>> GetAllAsync(
        int? managerUserId,
        int? propertyId,
        int? buildingId,
        bool? isActive);

    Task<ManagerAssignmentDto?> GetByIdAsync(int id);

    Task<ManagerAssignmentDto> CreateAsync(
        CreateManagerAssignmentDto createDto,
        int currentAdminUserId);

    Task<ManagerAssignmentDto?> EndAsync(
        int id,
        EndManagerAssignmentDto endDto,
        int currentAdminUserId);
}
