using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class UpdateDueDefinitionDto
{
    [Required(ErrorMessage = "Aidat tanım başlığı zorunludur.")]
    [StringLength(150, ErrorMessage = "Başlık en fazla 150 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Açıklama en fazla 500 karakter olabilir.")]
    public string? Description { get; set; }

    [Range(0.01, 999999999.99, ErrorMessage = "Aidat tutarı 0'dan büyük olmalıdır.")]
    public decimal Amount { get; set; }

    [Range(1, 28, ErrorMessage = "Son ödeme günü 1 ile 28 arasında olmalıdır.")]
    public int DueDay { get; set; }
}
