namespace ResidentialManagement.Api.DTOs;

public class CreatePropertyDto
{
    public string Name { get; set; } = string.Empty;

    public string PropertyType { get; set; } = string.Empty;

    public string AddressLine { get; set; } = string.Empty;

    public string City { get; set; } = string.Empty;

    public string District { get; set; } = string.Empty;

    public string? Description { get; set; }
}
