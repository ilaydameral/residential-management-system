using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class ResidentVehicle
{
    public long Id { get; set; }

    public int ResidentUserId { get; set; }
    public User ResidentUser { get; set; } = null!;

    public int UnitId { get; set; }
    public Unit Unit { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string PlateNumber { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string VehicleType { get; set; } = "CAR"; // CAR, MOTORCYCLE, ELECTRIC_VEHICLE, SUV, OTHER

    [MaxLength(100)]
    public string? BrandModel { get; set; }

    [MaxLength(50)]
    public string? Color { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
