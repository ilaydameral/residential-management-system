using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class UpdateUnitOccupancyDto : IValidatableObject
{
    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir ikamet türü seçilmelidir.")]
    public int OccupancyTypeId { get; set; }

    public DateTime StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public bool IsPrimary { get; set; }

    [StringLength(500, ErrorMessage = "Notlar en fazla 500 karakter olabilir.")]
    public string? Notes { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (StartDate == default)
        {
            yield return new ValidationResult(
                "Başlangıç tarihi zorunludur.",
                new[] { nameof(StartDate) }
            );
        }

        if (EndDate.HasValue && EndDate.Value < StartDate)
        {
            yield return new ValidationResult(
                "Bitiş tarihi başlangıç tarihinden önce olamaz.",
                new[] { nameof(EndDate) }
            );
        }
    }
}
