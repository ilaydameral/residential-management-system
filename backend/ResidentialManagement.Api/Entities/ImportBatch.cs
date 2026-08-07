using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class ImportBatch
{
    public int Id { get; set; }

    [MaxLength(50)]
    public string ImportType { get; set; } = string.Empty;

    [MaxLength(255)]
    public string OriginalFileName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string StorageKey { get; set; } = string.Empty;

    [MaxLength(64)]
    public string FileHashSha256 { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Status { get; set; } = "UPLOADED";

    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int InvalidRows { get; set; }
    public int ImportedRows { get; set; }
    public int SkippedRows { get; set; }

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ValidatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? RolledBackAt { get; set; }

    [MaxLength(1000)]
    public string? ErrorMessage { get; set; }

    public ICollection<ImportRowLog> RowLogs { get; set; } = new List<ImportRowLog>();
}
