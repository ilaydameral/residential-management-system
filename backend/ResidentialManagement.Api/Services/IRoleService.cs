using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IRoleService
{
    Task<List<RoleDto>> GetAllAsync();
}
