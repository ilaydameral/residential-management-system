namespace ResidentialManagement.Api.DTOs;

public class BuildingDto
{
    public int Id { get; set; }

    public int PropertyId { get; set; }

    public string PropertyName { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Code { get; set; } = string.Empty;

    public int FloorCount { get; set; }

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public int UnitCount { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
