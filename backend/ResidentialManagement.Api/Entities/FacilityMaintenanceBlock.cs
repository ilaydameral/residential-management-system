using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class FacilityMaintenanceBlock
{
    public int Id { get; set; }

    public int FacilityId { get; set; }
    public CommonFacility Facility { get; set; } = null!;

    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }

    [Required]
    [MaxLength(250)]
    public string Reason { get; set; } = string.Empty;

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
