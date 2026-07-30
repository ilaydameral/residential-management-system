using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class Unit
{
    public int Id { get; set; }

    public int BuildingId { get; set; }

    public int UnitTypeId { get; set; }

    [Required]
    [MaxLength(50)]
    public string UnitNumber { get; set; } = string.Empty;

    public int FloorNumber { get; set; }

    public decimal? GrossArea { get; set; }

    public decimal? NetArea { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public Building Building { get; set; } = null!;

    public UnitType UnitType { get; set; } = null!;
}
