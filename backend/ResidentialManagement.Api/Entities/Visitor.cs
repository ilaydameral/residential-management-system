using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class Visitor
{
    public long Id { get; set; }

    public int HostUserId { get; set; }
    public User HostUser { get; set; } = null!;

    public int UnitId { get; set; }
    public Unit Unit { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string VisitorName { get; set; } = null!;

    [MaxLength(20)]
    public string? VisitorPhone { get; set; }

    [Required]
    [MaxLength(30)]
    public string VisitorType { get; set; } = "GUEST"; // GUEST, SERVICE_PROVIDER, DELIVERY, COMMERCIAL

    [MaxLength(20)]
    public string? VehiclePlate { get; set; }

    public DateTime ExpectedArrival { get; set; }
    public DateTime ExpectedDeparture { get; set; }

    [Required]
    [MaxLength(20)]
    public string AccessCode { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "EXPECTED"; // EXPECTED, CHECKED_IN, CHECKED_OUT, CANCELLED, EXPIRED

    public DateTime? CheckedInAt { get; set; }

    public int? CheckedInByUserId { get; set; }
    public User? CheckedInByUser { get; set; }

    public DateTime? CheckedOutAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
