namespace ResidentialManagement.Api.DTOs;

public class ImportBatchDto
{
    public int Id { get; set; }
    public string ImportType { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public string FileHashSha256 { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int InvalidRows { get; set; }
    public int ImportedRows { get; set; }
    public int SkippedRows { get; set; }
    public int CreatedByUserId { get; set; }
    public string CreatedByFullName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ValidatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? RolledBackAt { get; set; }
    public string? ErrorMessage { get; set; }
}

public class ImportUploadResponseDto
{
    public ImportBatchDto Batch { get; set; } = new();
    public bool IsDuplicateUpload { get; set; }
    public string? DuplicateWarning { get; set; }
}

public class TargetFieldOptionDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
}

public class ImportColumnMappingOptionsDto
{
    public int BatchId { get; set; }
    public string ImportType { get; set; } = string.Empty;
    public List<string> SourceHeaders { get; set; } = new();
    public List<TargetFieldOptionDto> AllowedTargetFields { get; set; } = new();
    public Dictionary<string, string> SuggestedMappings { get; set; } = new();
}

public class ValidateImportBatchRequestDto
{
    public Dictionary<string, string> ColumnMappings { get; set; } = new();
}

public class ValidationErrorItemDto
{
    public string Code { get; set; } = string.Empty;
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class ImportRowLogDto
{
    public long Id { get; set; }
    public int ImportBatchId { get; set; }
    public int RowNumber { get; set; }
    public Dictionary<string, string> RawData { get; set; } = new();
    public Dictionary<string, string> MappedValues { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public string ActionPreview { get; set; } = string.Empty;
    public List<ValidationErrorItemDto> ValidationErrors { get; set; } = new();
    public int? CreatedEntityId { get; set; }
}

public class ImportPreviewResponseDto
{
    public ImportBatchDto Summary { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalFilteredRows { get; set; }
    public List<ImportRowLogDto> Rows { get; set; } = new();
}
