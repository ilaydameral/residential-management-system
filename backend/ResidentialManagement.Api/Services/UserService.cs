using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class UserService : IUserService
{
    private const int MaximumResultCount = 20;
    private readonly AppDbContext _context;

    public UserService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<UserSearchResultDto>> SearchAsync(
        string query,
        bool includeInactive = false)
    {
        var normalizedQuery = query?.Trim() ?? string.Empty;
        if (normalizedQuery.Length < 2)
        {
            throw new BadRequestException("Kullanıcı araması için en az 2 karakter girilmelidir.");
        }

        var users = _context.Users
            .AsNoTracking()
            .Where(u =>
                u.FirstName.Contains(normalizedQuery) ||
                u.LastName.Contains(normalizedQuery) ||
                u.Email.Contains(normalizedQuery));

        if (!includeInactive)
        {
            users = users.Where(u => u.IsActive);
        }

        return await users
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .ThenBy(u => u.Id)
            .Select(u => new UserSearchResultDto
            {
                Id = u.Id,
                FullName = (u.FirstName + " " + u.LastName).Trim(),
                Email = u.Email,
                IsActive = u.IsActive
            })
            .Take(MaximumResultCount)
            .ToListAsync();
    }
}
