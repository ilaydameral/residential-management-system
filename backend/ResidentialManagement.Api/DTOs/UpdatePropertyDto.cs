using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class UpdatePropertyDto : IValidatableObject
{
    [Required(ErrorMessage = "Gayrimenkul adı zorunludur.")]
    [StringLength(150, ErrorMessage = "Gayrimenkul adı en fazla 150 karakter olabilir.")]
    public string Name { get; set; } = string.Empty;

    public int? PropertyTypeId { get; set; }

    [StringLength(50, ErrorMessage = "Gayrimenkul türü en fazla 50 karakter olabilir.")]
    public string? PropertyType { get; set; }

    [Required(ErrorMessage = "Adres satırı zorunludur.")]
    [StringLength(500, ErrorMessage = "Adres satırı en fazla 500 karakter olabilir.")]
    public string AddressLine { get; set; } = string.Empty;

    [Required(ErrorMessage = "Şehir bilgisi zorunludur.")]
    [StringLength(100, ErrorMessage = "Şehir adı en fazla 100 karakter olabilir.")]
    public string City { get; set; } = string.Empty;

    [Required(ErrorMessage = "İlçe bilgisi zorunludur.")]
    [StringLength(100, ErrorMessage = "İlçe adı en fazla 100 karakter olabilir.")]
    public string District { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Açıklama en fazla 500 karakter olabilir.")]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!PropertyTypeId.HasValue && string.IsNullOrWhiteSpace(PropertyType))
        {
            yield return new ValidationResult(
                "Gayrimenkul türü seçilmeli veya belirtilmelidir.",
                new[] { nameof(PropertyTypeId), nameof(PropertyType) }
            );
        }
    }
}
