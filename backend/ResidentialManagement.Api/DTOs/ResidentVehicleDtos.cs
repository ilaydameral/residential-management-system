using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class CreateResidentVehicleDto
{
    [Required]
    public int UnitId { get; set; }

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
}

public class UpdateResidentVehicleDto
{
    [Required]
    [MaxLength(30)]
    public string VehicleType { get; set; } = "CAR";

    [MaxLength(100)]
    public string? BrandModel { get; set; }

    [MaxLength(50)]
    public string? Color { get; set; }
}

public class ResidentVehicleDto
{
    public long Id { get; set; }
    public int ResidentUserId { get; set; }
    public string ResidentUserName { get; set; } = null!;
    public int UnitId { get; set; }
    public string UnitNumber { get; set; } = null!;
    public string BuildingName { get; set; } = null!;
    public string PropertyName { get; set; } = null!;
    public int PropertyId { get; set; }
    public int BuildingId { get; set; }
    public string PlateNumber { get; set; } = null!;
    public string VehicleType { get; set; } = null!;
    public string? BrandModel { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ResidentVehicleFilterDto
{
    public int? PropertyId { get; set; }
    public int? BuildingId { get; set; }
    public int? UnitId { get; set; }
    public string? PlateNumber { get; set; }
    public string? VehicleType { get; set; }
    public bool? IsActive { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public class PagedResidentVehicleResultDto
{
    public List<ResidentVehicleDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}
