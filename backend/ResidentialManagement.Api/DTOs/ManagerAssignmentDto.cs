namespace ResidentialManagement.Api.DTOs;

public class ManagerAssignmentDto
{
    public int Id { get; set; }

    public int ManagerUserId { get; set; }
    public string ManagerUserName { get; set; } = string.Empty;
    public string ManagerFullName { get; set; } = string.Empty;
    public string ManagerEmail { get; set; } = string.Empty;

    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;

    public int? BuildingId { get; set; }
    public string? BuildingName { get; set; }
    public string? BuildingCode { get; set; }

    public string ScopeType { get; set; } = string.Empty;

    public DateTime AssignedAt { get; set; }
    public int AssignedByUserId { get; set; }
    public string AssignedByFullName { get; set; } = string.Empty;

    public bool IsActive { get; set; }
    public DateTime? EndedAt { get; set; }
    public int? EndedByUserId { get; set; }
    public string? EndedByFullName { get; set; }
    public string? EndReason { get; set; }
}
