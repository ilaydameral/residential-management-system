using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PropertiesController : ControllerBase
{
    private readonly AppDbContext _context;

    public PropertiesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<Property>>> GetProperties()
    {
        var properties = await _context.Properties
            .OrderBy(property => property.Id)
            .ToListAsync();

        return Ok(properties);
    }

    [HttpPost]
    public async Task<ActionResult<Property>> CreateProperty(
        Property property
    )
    {
        _context.Properties.Add(property);

        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetPropertyById),
            new { id = property.Id },
            property
        );
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Property>> GetPropertyById(int id)
    {
        var property = await _context.Properties.FindAsync(id);

        if (property is null)
        {
            return NotFound();
        }

        return Ok(property);
    }
}