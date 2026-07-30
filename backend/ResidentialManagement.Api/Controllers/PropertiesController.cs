using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PropertiesController : ControllerBase
{
    private readonly IPropertyService _propertyService;

    public PropertiesController(IPropertyService propertyService)
    {
        _propertyService = propertyService;
    }

    [HttpGet]
    public async Task<ActionResult<List<PropertyDto>>> GetProperties([FromQuery] bool includeInactive = false)
    {
        var properties = await _propertyService.GetAllPropertiesAsync(includeInactive);
        return Ok(properties);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PropertyDto>> GetPropertyById(int id)
    {
        var property = await _propertyService.GetPropertyByIdAsync(id);
        if (property is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(property);
    }

    [HttpPost]
    public async Task<ActionResult<PropertyDto>> CreateProperty(CreatePropertyDto createDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var createdProperty = await _propertyService.CreatePropertyAsync(createDto);

        return CreatedAtAction(
            nameof(GetPropertyById),
            new { id = createdProperty.Id },
            createdProperty
        );
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PropertyDto>> UpdateProperty(int id, UpdatePropertyDto updateDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var updatedProperty = await _propertyService.UpdatePropertyAsync(id, updateDto);
        if (updatedProperty is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(updatedProperty);
    }

    [HttpPatch("{id:int}/deactivate")]
    public async Task<IActionResult> DeactivateProperty(int id)
    {
        var success = await _propertyService.DeactivatePropertyAsync(id);
        if (!success)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return NoContent();
    }
}