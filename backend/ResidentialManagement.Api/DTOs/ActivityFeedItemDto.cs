using System;

namespace ResidentialManagement.Api.DTOs;

public class ActivityFeedItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // MAINTENANCE | ANNOUNCEMENT | FINANCE | OCCUPANCY | MANAGEMENT
    public string ActivityType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ActorName { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }

    public int? PropertyId { get; set; }
    public int? BuildingId { get; set; }
    public int? UnitId { get; set; }
    public int? RelatedEntityId { get; set; }

    public string? TargetView { get; set; }
    public string? RouteParams { get; set; }
}

public class PagedActivityFeedDto
{
    public List<ActivityFeedItemDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}
