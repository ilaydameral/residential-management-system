using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class EndUnitOccupancyDto : IValidatableObject
{
    public DateTime EndDate { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (EndDate == default)
        {
            yield return new ValidationResult(
                "Bitiş tarihi zorunludur.",
                new[] { nameof(EndDate) }
            );
        }
    }
}
