using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public class RoleService : IRoleService
{
    private readonly AppDbContext _context;

    public RoleService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<RoleDto>> GetAllAsync()
    {
        return await _context.Roles
            .AsNoTracking()
            .OrderBy(role => role.Id)
            .Select(role => new RoleDto
            {
                Id = role.Id,
                Code = role.Code,
                Name = role.Name,
                IsActive = role.IsActive
            })
            .ToListAsync();
    }
}
