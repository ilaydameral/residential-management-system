using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class UpdateUnitDto : IValidatableObject
{
    [Required(ErrorMessage = "Bina seçimi zorunludur.")]
    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir bina seçilmelidir.")]
    public int BuildingId { get; set; }

    [Required(ErrorMessage = "Bölüm türü seçimi zorunludur.")]
    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir bölüm türü seçilmelidir.")]
    public int UnitTypeId { get; set; }

    [Required(ErrorMessage = "Kapı/Bölüm numarası zorunludur.")]
    [StringLength(50, ErrorMessage = "Kapı/Bölüm numarası en fazla 50 karakter olabilir.")]
    public string UnitNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Kat numarası zorunludur.")]
    public int FloorNumber { get; set; }

    [Range(0.01, 999999.99, ErrorMessage = "Brüt alan 0'dan büyük olmalıdır.")]
    public decimal? GrossArea { get; set; }

    [Range(0.01, 999999.99, ErrorMessage = "Net alan 0'dan büyük olmalıdır.")]
    public decimal? NetArea { get; set; }

    [StringLength(500, ErrorMessage = "Açıklama en fazla 500 karakter olabilir.")]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (GrossArea.HasValue && NetArea.HasValue && NetArea.Value > GrossArea.Value)
        {
            yield return new ValidationResult(
                "Net alan brüt alandan büyük olamaz.",
                new[] { nameof(NetArea) }
            );
        }
    }
}
