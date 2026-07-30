using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/property-types")]
public class PropertyTypesController : ControllerBase
{
    private readonly IPropertyTypeService _propertyTypeService;

    public PropertyTypesController(IPropertyTypeService propertyTypeService)
    {
        _propertyTypeService = propertyTypeService;
    }

    [HttpGet]
    public async Task<ActionResult<List<PropertyTypeDto>>> GetPropertyTypes([FromQuery] bool includeInactive = false)
    {
        var propertyTypes = await _propertyTypeService.GetAllPropertyTypesAsync(includeInactive);
        return Ok(propertyTypes);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PropertyTypeDto>> GetPropertyTypeById(int id)
    {
        var propertyType = await _propertyTypeService.GetPropertyTypeByIdAsync(id);
        if (propertyType is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul türü bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(propertyType);
    }

    [HttpPost]
    public async Task<ActionResult<PropertyTypeDto>> CreatePropertyType(CreatePropertyTypeDto createDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var createdPropertyType = await _propertyTypeService.CreatePropertyTypeAsync(createDto);

        return CreatedAtAction(
            nameof(GetPropertyTypeById),
            new { id = createdPropertyType.Id },
            createdPropertyType
        );
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PropertyTypeDto>> UpdatePropertyType(int id, UpdatePropertyTypeDto updateDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var updatedPropertyType = await _propertyTypeService.UpdatePropertyTypeAsync(id, updateDto);
        if (updatedPropertyType is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul türü bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(updatedPropertyType);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletePropertyType(int id)
    {
        var deleted = await _propertyTypeService.DeletePropertyTypeAsync(id);
        if (!deleted)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = $"ID'si {id} olan gayrimenkul türü bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return NoContent();
    }
}
