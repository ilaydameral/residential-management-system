using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class CreateVisitorDto
{
    [Required]
    public int UnitId { get; set; }

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

    [Required]
    public DateTime ExpectedArrival { get; set; }

    [Required]
    public DateTime ExpectedDeparture { get; set; }
}

public class VisitorDto
{
    public long Id { get; set; }
    public int HostUserId { get; set; }
    public string HostUserName { get; set; } = null!;
    public int UnitId { get; set; }
    public string UnitNumber { get; set; } = null!;
    public string BuildingName { get; set; } = null!;
    public string PropertyName { get; set; } = null!;
    public int PropertyId { get; set; }
    public int BuildingId { get; set; }
    public string VisitorName { get; set; } = null!;
    public string? VisitorPhone { get; set; }
    public string VisitorType { get; set; } = null!;
    public string? VehiclePlate { get; set; }
    public DateTime ExpectedArrival { get; set; }
    public DateTime ExpectedDeparture { get; set; }
    public string AccessCode { get; set; } = null!;
    public string Status { get; set; } = null!;
    public DateTime? CheckedInAt { get; set; }
    public string? CheckedInByUserName { get; set; }
    public DateTime? CheckedOutAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class VisitorFilterDto
{
    public int? PropertyId { get; set; }
    public int? BuildingId { get; set; }
    public int? UnitId { get; set; }
    public string? Status { get; set; }
    public string? Search { get; set; }
    public string? VehiclePlate { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public class PagedVisitorResultDto
{
    public List<VisitorDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

public class VisitorStatusChangedEvent
{
    public long VisitorId { get; set; }
    public int UnitId { get; set; }
    public string Status { get; set; } = null!;
    public DateTime UpdatedAt { get; set; }
}
