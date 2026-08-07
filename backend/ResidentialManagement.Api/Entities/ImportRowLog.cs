using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.Entities;

public class ImportRowLog
{
    public long Id { get; set; }

    public int ImportBatchId { get; set; }
    public ImportBatch ImportBatch { get; set; } = null!;

    public int RowNumber { get; set; }

    public string RawDataJson { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Status { get; set; } = "PENDING";

    [MaxLength(30)]
    public string ActionPreview { get; set; } = "CREATE";

    public string? ErrorMessagesJson { get; set; }

    public int? CreatedEntityId { get; set; }
}
