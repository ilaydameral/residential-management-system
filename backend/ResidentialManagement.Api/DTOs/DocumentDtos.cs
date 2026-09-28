using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class CreateDocumentRequestDto
{
    [Range(1, int.MaxValue)]
    public int PropertyId { get; set; }
    public int? BuildingId { get; set; }
    public int? UnitId { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    [Required, StringLength(30)]
    public string Category { get; set; } = string.Empty;

    [Required, StringLength(30)]
    public string Visibility { get; set; } = string.Empty;

    public IFormFile? File { get; set; }
}

public class UpdateDocumentMetadataDto
{
    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    [Required, StringLength(30)]
    public string Category { get; set; } = string.Empty;

    [Required, StringLength(30)]
    public string Visibility { get; set; } = string.Empty;
}

public class UpdateDocumentStatusDto
{
    public bool IsActive { get; set; }
}

public class DocumentDto
{
    public int Id { get; set; }
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int? BuildingId { get; set; }
    public string? BuildingName { get; set; }
    public string? BuildingCode { get; set; }
    public int? UnitId { get; set; }
    public string? UnitNumber { get; set; }
    public string TargetType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public string Visibility { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int UploadedByUserId { get; set; }
    public string UploadedByName { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? ArchivedAt { get; set; }
    public int? ArchivedByUserId { get; set; }
    public string? ArchivedByName { get; set; }
}

public class DocumentListResponseDto
{
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<DocumentDto> Items { get; set; } = new();
}
