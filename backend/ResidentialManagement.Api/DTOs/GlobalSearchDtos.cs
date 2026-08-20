namespace ResidentialManagement.Api.DTOs;

public class GlobalSearchResponseDto
{
    public string Query { get; set; } = string.Empty;
    public List<GlobalSearchItemDto> Properties { get; set; } = [];
    public List<GlobalSearchItemDto> Buildings { get; set; } = [];
    public List<GlobalSearchItemDto> Units { get; set; } = [];
    public List<GlobalSearchItemDto> Users { get; set; } = [];
    public List<GlobalSearchItemDto> MaintenanceRequests { get; set; } = [];
    public List<GlobalSearchItemDto> Announcements { get; set; } = [];
}

public class GlobalSearchItemDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty; // "PROPERTY", "BUILDING", "UNIT", "USER", "MAINTENANCE", "ANNOUNCEMENT"
    public string TargetView { get; set; } = string.Empty;
    public Dictionary<string, string> RouteParams { get; set; } = [];
}
