using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IUserService
{
    Task<List<UserManagementDto>> GetAllAsync(string? search, string? role, bool? isActive);
    Task<UserDetailDto?> GetDetailAsync(int id);
    Task<AccountProfileDto?> GetCurrentProfileAsync(int id);
    Task<AccountProfileDto?> UpdateCurrentProfileAsync(int id, UpdateAccountProfileDto updateDto);
    Task ChangeCurrentPasswordAsync(int id, ChangeAccountPasswordDto changeDto);
    Task<List<UserSearchResultDto>> SearchAsync(string? query, string? role = null, bool includeInactive = false);
    Task<UserManagementDto> CreateAsync(CreateManagedUserDto createDto);
    Task<UserManagementDto?> UpdateAsync(int id, UpdateManagedUserDto updateDto);
    Task<UserManagementDto?> SetActiveAsync(int id, bool isActive, int currentUserId);
    Task<UserManagementDto?> UpdateRolesAsync(int id, UpdateUserRolesDto updateDto, int currentUserId);
}
