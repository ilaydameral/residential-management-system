using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class DueDefinition
{
    public int Id { get; set; }

    public int PropertyId { get; set; }
    public Property Property { get; set; } = null!;

    public int? BuildingId { get; set; }
    public Building? Building { get; set; }

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public decimal Amount { get; set; }

    public int DueDay { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public DateTime? UpdatedAt { get; set; }

    public int? UpdatedByUserId { get; set; }
    public User? UpdatedByUser { get; set; }

    public ICollection<DuePeriod> DuePeriods { get; set; } = new List<DuePeriod>();
}
