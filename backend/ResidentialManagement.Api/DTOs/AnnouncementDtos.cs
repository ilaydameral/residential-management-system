using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class AnnouncementCreateDto
{
    [Required(ErrorMessage = "Gayrimenkul ID belirtilmelidir.")]
    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir Gayrimenkul ID girilmelidir.")]
    public int PropertyId { get; set; }

    public int? BuildingId { get; set; }

    [Required(ErrorMessage = "Duyuru başlığı boş olamaz.")]
    [StringLength(200, ErrorMessage = "Duyuru başlığı en fazla 200 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Duyuru içeriği boş olamaz.")]
    public string Content { get; set; } = string.Empty;

    [StringLength(30)]
    public string Priority { get; set; } = "NORMAL";
}

public class AnnouncementUpdateDto
{
    [Required(ErrorMessage = "Duyuru başlığı boş olamaz.")]
    [StringLength(200, ErrorMessage = "Duyuru başlığı en fazla 200 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Duyuru içeriği boş olamaz.")]
    public string Content { get; set; } = string.Empty;

    [StringLength(30)]
    public string Priority { get; set; } = "NORMAL";
}

public class AnnouncementListItemDto
{
    public int Id { get; set; }
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int? BuildingId { get; set; }
    public string? BuildingName { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Priority { get; set; } = "NORMAL";
    public string Status { get; set; } = "DRAFT";
    public int CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
}

public class AnnouncementDetailDto : AnnouncementListItemDto
{
    public string Content { get; set; } = string.Empty;
}

public class AnnouncementListResponseDto
{
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<AnnouncementListItemDto> Items { get; set; } = new();
}
