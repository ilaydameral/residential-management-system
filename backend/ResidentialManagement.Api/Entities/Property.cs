using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class Property
{
    public int Id { get; set; }

    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string PropertyType { get; set; } = string.Empty;

    public int? PropertyTypeId { get; set; }

    public PropertyType? PropertyTypeLookup { get; set; }

    [MaxLength(500)]
    public string AddressLine { get; set; } = string.Empty;

    [MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [MaxLength(100)]
    public string District { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<Building> Buildings { get; set; } = new List<Building>();
}
