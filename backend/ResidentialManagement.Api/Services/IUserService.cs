using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IUserService
{
    Task<List<UserSearchResultDto>> SearchAsync(string query, bool includeInactive = false);
}
