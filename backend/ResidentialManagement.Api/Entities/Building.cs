using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class Building
{
    public int Id { get; set; }

    public int PropertyId { get; set; }

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [Range(1, 200, ErrorMessage = "Kat sayısı en az 1 olmalıdır.")]
    public int FloorCount { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public Property Property { get; set; } = null!;

    public ICollection<Unit> Units { get; set; } = new List<Unit>();
}
