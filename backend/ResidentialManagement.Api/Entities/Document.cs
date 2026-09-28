using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class Document
{
    public int Id { get; set; }
    public int PropertyId { get; set; }
    public int? BuildingId { get; set; }
    public int? UnitId { get; set; }

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(30)]
    public string Category { get; set; } = DocumentCategories.General;

    [MaxLength(255)]
    public string OriginalFileName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string StorageKey { get; set; } = string.Empty;

    [MaxLength(150)]
    public string ContentType { get; set; } = string.Empty;

    public long FileSize { get; set; }

    [MaxLength(64)]
    public string Sha256 { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Visibility { get; set; } = DocumentVisibilities.ManagementOnly;

    public bool IsActive { get; set; } = true;
    public int UploadedByUserId { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? ArchivedAt { get; set; }
    public int? ArchivedByUserId { get; set; }

    public Property Property { get; set; } = null!;
    public Building? Building { get; set; }
    public Unit? Unit { get; set; }
    public User UploadedByUser { get; set; } = null!;
    public User? ArchivedByUser { get; set; }
}

public static class DocumentCategories
{
    public const string General = "GENERAL";
    public const string Management = "MANAGEMENT";
    public const string Finance = "FINANCE";
    public const string Meeting = "MEETING";
    public const string Maintenance = "MAINTENANCE";
    public const string Legal = "LEGAL";
    public const string Technical = "TECHNICAL";
    public const string Other = "OTHER";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        General, Management, Finance, Meeting, Maintenance, Legal, Technical, Other
    };
}

public static class DocumentVisibilities
{
    public const string ManagementOnly = "MANAGEMENT_ONLY";
    public const string Residents = "RESIDENTS";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        ManagementOnly, Residents
    };
}
