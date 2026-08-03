using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public class OccupancyTypeService : IOccupancyTypeService
{
    private readonly AppDbContext _context;

    public OccupancyTypeService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<OccupancyTypeDto>> GetActiveAsync()
    {
        return await _context.OccupancyTypes
            .AsNoTracking()
            .Where(type => type.IsActive)
            .OrderBy(type => type.Id)
            .Select(type => new OccupancyTypeDto
            {
                Id = type.Id,
                Code = type.Code,
                Name = type.Name
            })
            .ToListAsync();
    }
}
