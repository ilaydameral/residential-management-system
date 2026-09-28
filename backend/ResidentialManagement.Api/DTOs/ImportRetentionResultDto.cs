namespace ResidentialManagement.Api.DTOs;

public class ImportRetentionResultDto
{
    public int EligibleBatchesEvaluated { get; set; }
    public int FilesDeleted { get; set; }
    public int RowLogsRedacted { get; set; }
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
