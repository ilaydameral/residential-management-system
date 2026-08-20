using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class CommonFacility
{
    public int Id { get; set; }

    public int PropertyId { get; set; }
    public Property Property { get; set; } = null!;

    public int? BuildingId { get; set; }
    public Building? Building { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(200)]
    public string? LocationHint { get; set; }

    public int Capacity { get; set; } = 1;

    public TimeSpan OpeningTime { get; set; } = new TimeSpan(8, 0, 0);
    public TimeSpan ClosingTime { get; set; } = new TimeSpan(22, 0, 0);

    public int SlotDurationMinutes { get; set; } = 60;

    public bool RequiresManagerApproval { get; set; } = false;

    public int MaxActiveReservationsPerResident { get; set; } = 2;

    public int CancellationLeadTimeHours { get; set; } = 2;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<FacilityReservation> Reservations { get; set; } = new List<FacilityReservation>();
    public ICollection<FacilityMaintenanceBlock> MaintenanceBlocks { get; set; } = new List<FacilityMaintenanceBlock>();
}
