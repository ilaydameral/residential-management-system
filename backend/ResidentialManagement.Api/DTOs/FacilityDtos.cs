using System;
using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class CommonFacilityDto
{
    public int Id { get; set; }
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int? BuildingId { get; set; }
    public string? BuildingName { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LocationHint { get; set; }
    public int Capacity { get; set; }
    public string OpeningTime { get; set; } = string.Empty; // e.g. "08:00"
    public string ClosingTime { get; set; } = string.Empty; // e.g. "22:00"
    public int SlotDurationMinutes { get; set; }
    public bool RequiresManagerApproval { get; set; }
    public int MaxActiveReservationsPerResident { get; set; }
    public int CancellationLeadTimeHours { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateCommonFacilityDto
{
    [Required]
    public int PropertyId { get; set; }
    public int? BuildingId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(200)]
    public string? LocationHint { get; set; }

    [Range(1, 1000)]
    public int Capacity { get; set; } = 1;

    [Required]
    public string OpeningTime { get; set; } = "08:00";

    [Required]
    public string ClosingTime { get; set; } = "22:00";

    [Range(15, 1440)]
    public int SlotDurationMinutes { get; set; } = 60;

    public bool RequiresManagerApproval { get; set; } = false;

    [Range(1, 10)]
    public int MaxActiveReservationsPerResident { get; set; } = 2;

    [Range(0, 168)]
    public int CancellationLeadTimeHours { get; set; } = 2;
}

public class UpdateCommonFacilityDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(200)]
    public string? LocationHint { get; set; }

    [Range(1, 1000)]
    public int Capacity { get; set; } = 1;

    [Required]
    public string OpeningTime { get; set; } = "08:00";

    [Required]
    public string ClosingTime { get; set; } = "22:00";

    [Range(15, 1440)]
    public int SlotDurationMinutes { get; set; } = 60;

    public bool RequiresManagerApproval { get; set; } = false;

    [Range(1, 10)]
    public int MaxActiveReservationsPerResident { get; set; } = 2;

    [Range(0, 168)]
    public int CancellationLeadTimeHours { get; set; } = 2;
}

public class FacilityReservationDto
{
    public long Id { get; set; }
    public int FacilityId { get; set; }
    public string FacilityName { get; set; } = string.Empty;
    public int ResidentUserId { get; set; }
    public string ResidentName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public string BuildingName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Note { get; set; }
    public string? ReviewedByName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateReservationDto
{
    [Required]
    public int FacilityId { get; set; }

    [Required]
    public int UnitId { get; set; }

    [Required]
    public DateTime StartTime { get; set; }

    [Required]
    public DateTime EndTime { get; set; }

    [MaxLength(500)]
    public string? Note { get; set; }
}

public class ReviewReservationDto
{
    [MaxLength(500)]
    public string? RejectionReason { get; set; }
}

public class FacilityMaintenanceBlockDto
{
    public int Id { get; set; }
    public int FacilityId { get; set; }
    public string FacilityName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreateMaintenanceBlockDto
{
    [Required]
    public DateTime StartTime { get; set; }

    [Required]
    public DateTime EndTime { get; set; }

    [Required]
    [MaxLength(250)]
    public string Reason { get; set; } = string.Empty;
}

public class FacilityAvailabilityDto
{
    public int FacilityId { get; set; }
    public string FacilityName { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty; // YYYY-MM-DD
    public string OpeningTime { get; set; } = string.Empty;
    public string ClosingTime { get; set; } = string.Empty;
    public int SlotDurationMinutes { get; set; }
    public List<TimeSlotDto> Slots { get; set; } = new();
}

public class TimeSlotDto
{
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Status { get; set; } = "AVAILABLE"; // AVAILABLE, BOOKED, BLOCKED, PAST
    public string? Reason { get; set; }
}
