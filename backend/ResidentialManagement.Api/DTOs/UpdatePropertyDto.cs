using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class UpdatePropertyDto
{
    [Required(ErrorMessage = "Gayrimenkul adı zorunludur.")]
    [StringLength(150, ErrorMessage = "Gayrimenkul adı en fazla 150 karakter olabilir.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Gayrimenkul türü zorunludur.")]
    [StringLength(50, ErrorMessage = "Gayrimenkul türü en fazla 50 karakter olabilir.")]
    public string PropertyType { get; set; } = string.Empty;

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
}
