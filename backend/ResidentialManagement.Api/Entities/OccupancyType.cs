using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class OccupancyType
{
    public int Id { get; set; }

    [Required]
    [StringLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(250)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<UnitOccupancy> UnitOccupancies { get; set; } = new List<UnitOccupancy>();
}
