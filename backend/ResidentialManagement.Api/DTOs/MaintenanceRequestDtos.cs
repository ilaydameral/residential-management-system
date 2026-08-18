using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class MaintenanceRequestCreateDto
{
    [Required(ErrorMessage = "Bağımsız bölüm (Unit) ID belirtilmelidir.")]
    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir Unit ID girilmelidir.")]
    public int UnitId { get; set; }

    [Required(ErrorMessage = "Kategori seçilmelidir.")]
    [StringLength(50, ErrorMessage = "Kategori en fazla 50 karakter olabilir.")]
    public string Category { get; set; } = string.Empty;

    [Required(ErrorMessage = "Talep başlığı boş olamaz.")]
    [StringLength(200, ErrorMessage = "Talep başlığı en fazla 200 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Talep açıklaması boş olamaz.")]
    public string Description { get; set; } = string.Empty;
}

public class MaintenanceRequestAssignDto
{
    [Required(ErrorMessage = "Atanacak personel ID belirtilmelidir.")]
    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir personel ID girilmelidir.")]
    public int AssignedToUserId { get; set; }
}

public class MaintenanceRequestPriorityUpdateDto
{
    [Required(ErrorMessage = "Öncelik derecesi belirtilmelidir.")]
    [StringLength(30, ErrorMessage = "Öncelik en fazla 30 karakter olabilir.")]
    public string Priority { get; set; } = "NORMAL";
}

public class MaintenanceRequestStatusUpdateDto
{
    [Required(ErrorMessage = "Yeni durum belirtilmelidir.")]
    [StringLength(30, ErrorMessage = "Durum en fazla 30 karakter olabilir.")]
    public string NewStatus { get; set; } = string.Empty;

    [StringLength(1000, ErrorMessage = "Açıklama notu en fazla 1000 karakter olabilir.")]
    public string? Note { get; set; }
}

public class MaintenanceRequestNoteDto
{
    [Required(ErrorMessage = "Eklemek istediğiniz not metni boş olamaz.")]
    [StringLength(1000, ErrorMessage = "Not en fazla 1000 karakter olabilir.")]
    public string Note { get; set; } = string.Empty;
}

public class MaintenanceRequestHistoryDto
{
    public long Id { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public string? OldStatus { get; set; }
    public string? NewStatus { get; set; }
    public int? OldAssignedToUserId { get; set; }
    public string? OldAssignedToName { get; set; }
    public int? NewAssignedToUserId { get; set; }
    public string? NewAssignedToName { get; set; }
    public string? Note { get; set; }
    public int ChangedByUserId { get; set; }
    public string ChangedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class MaintenanceRequestAttachmentDto
{
    public int Id { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public int UploadedByUserId { get; set; }
    public string UploadedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class MaintenanceRequestListItemDto
{
    public int Id { get; set; }
    public string RequestNumber { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int BuildingId { get; set; }
    public string BuildingName { get; set; } = string.Empty;
    public string UnitNumber { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Priority { get; set; } = "NORMAL";
    public string Status { get; set; } = "OPEN";
    public int CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public int? AssignedToUserId { get; set; }
    public string? AssignedToName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
}

public class MaintenanceRequestDetailDto : MaintenanceRequestListItemDto
{
    public string Description { get; set; } = string.Empty;
    public List<MaintenanceRequestHistoryDto> Histories { get; set; } = new();
    public List<MaintenanceRequestAttachmentDto> Attachments { get; set; } = new();
}

public class MaintenanceRequestListResponseDto
{
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<MaintenanceRequestListItemDto> Items { get; set; } = new();
}
