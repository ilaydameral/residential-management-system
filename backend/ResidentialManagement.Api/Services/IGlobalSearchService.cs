using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IGlobalSearchService
{
    Task<GlobalSearchResponseDto> SearchAsync(string query, int limit, int userId, bool isAdmin);
}
