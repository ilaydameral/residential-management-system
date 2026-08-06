using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class ManualUnitApportionmentItemDto
{
    [Required(ErrorMessage = "Daire seçimi (UnitId) zorunludur.")]
    public int UnitId { get; set; }

    [Range(0.01, 999999999.99, ErrorMessage = "Daireye yansıtılan tutar 0'dan büyük olmalıdır.")]
    public decimal Amount { get; set; }
}
