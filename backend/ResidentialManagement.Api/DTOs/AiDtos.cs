using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public sealed class MaintenanceAiSuggestionRequestDto
{
    [Required(ErrorMessage = "Talep başlığı boş olamaz.")]
    [StringLength(200, MinimumLength = 3, ErrorMessage = "Talep başlığı 3 ile 200 karakter arasında olmalıdır.")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Talep açıklaması boş olamaz.")]
    [StringLength(2000, MinimumLength = 10, ErrorMessage = "Talep açıklaması 10 ile 2000 karakter arasında olmalıdır.")]
    public string Description { get; set; } = string.Empty;
}

public sealed class MaintenanceAiSuggestionDto
{
    public string SuggestedCategory { get; set; } = string.Empty;
    public string SuggestedPriority { get; set; } = string.Empty;
    public decimal? Confidence { get; set; }
    public string Explanation { get; set; } = string.Empty;
    public List<string> Warnings { get; set; } = new();
}

public sealed class MaintenanceDescriptionImprovementRequestDto
{
    [Required(ErrorMessage = "Talep açıklaması boş olamaz.")]
    [StringLength(2000, MinimumLength = 1, ErrorMessage = "Talep açıklaması en fazla 2000 karakter olabilir.")]
    public string Description { get; set; } = string.Empty;
}

public sealed class MaintenanceDescriptionImprovementDto
{
    public string ImprovedDescription { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; }
}

public sealed class AnnouncementTextImprovementRequestDto
{
    [Required(ErrorMessage = "Duyuru metni boş olamaz.")]
    [StringLength(5000, MinimumLength = 1, ErrorMessage = "Duyuru metni en fazla 5000 karakter olabilir.")]
    public string Text { get; set; } = string.Empty;

    [Required(ErrorMessage = "İyileştirme modu zorunludur.")]
    [StringLength(30, ErrorMessage = "Geçerli bir iyileştirme modu seçin.")]
    public string Mode { get; set; } = string.Empty;
}

public sealed class AnnouncementTextImprovementDto
{
    public string ImprovedText { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; }
}

public sealed class MaintenanceImageAnalysisRequestDto
{
    [Required(ErrorMessage = "Analiz edilecek görsel zorunludur.")]
    public IFormFile Image { get; set; } = null!;

    [StringLength(200, ErrorMessage = "Talep başlığı en fazla 200 karakter olabilir.")]
    public string? Title { get; set; }

    [StringLength(2000, ErrorMessage = "Talep açıklaması en fazla 2000 karakter olabilir.")]
    public string? Description { get; set; }
}

public sealed class MaintenanceImageAnalysisDto
{
    public string Observation { get; set; } = string.Empty;
    public string SuggestedCategory { get; set; } = string.Empty;
    public string SuggestedPriority { get; set; } = string.Empty;
    public decimal? Confidence { get; set; }
    public List<string> Warnings { get; set; } = new();
    public DateTime GeneratedAt { get; set; }
}

public sealed class AnalyticsAiInsightRequestDto
{
    public int? PropertyId { get; set; }
    public int? BuildingId { get; set; }

    [Required(ErrorMessage = "Başlangıç tarihi zorunludur.")]
    public DateTime? FromDate { get; set; }

    [Required(ErrorMessage = "Bitiş tarihi zorunludur.")]
    public DateTime? ToDate { get; set; }
}

public sealed class AnalyticsAiInsightDto
{
    public string Summary { get; set; } = string.Empty;
    public List<string> Highlights { get; set; } = new();
    public List<string> AttentionPoints { get; set; } = new();
    public bool AiEnhanced { get; set; }
    public DateTime GeneratedAt { get; set; }
}
