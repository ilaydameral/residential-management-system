using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class UnitOccupancy
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int UnitId { get; set; }
    public Unit Unit { get; set; } = null!;

    public int OccupancyTypeId { get; set; }
    public OccupancyType OccupancyType { get; set; } = null!;

    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }

    public bool IsActive { get; set; } = true;
    public bool IsPrimary { get; set; } = false;

    [StringLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
