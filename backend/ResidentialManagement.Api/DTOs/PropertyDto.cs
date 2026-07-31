namespace ResidentialManagement.Api.DTOs;

public class PropertyDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public int? PropertyTypeId { get; set; }

    public string PropertyType { get; set; } = string.Empty;

    public string? PropertyTypeName { get; set; }

    public string AddressLine { get; set; } = string.Empty;

    public string City { get; set; } = string.Empty;

    public string District { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }
}
