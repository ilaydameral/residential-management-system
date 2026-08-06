using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class CreateDraftDuePeriodDto
{
    [Required(ErrorMessage = "Aidat tanımı seçimi zorunludur.")]
    public int DueDefinitionId { get; set; }

    [Range(2020, 2100, ErrorMessage = "Yıl 2020 ile 2100 arasında olmalıdır.")]
    public int Year { get; set; }

    [Range(1, 12, ErrorMessage = "Ay 1 ile 12 arasında olmalıdır.")]
    public int Month { get; set; }
}
