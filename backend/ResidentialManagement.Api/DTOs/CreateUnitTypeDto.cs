using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class CreateUnitTypeDto
{
    [Required(ErrorMessage = "Bölüm türü adı zorunludur.")]
    [StringLength(100, ErrorMessage = "Bölüm türü adı en fazla 100 karakter olabilir.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Bölüm türü kodu zorunludur.")]
    [StringLength(50, ErrorMessage = "Bölüm türü kodu en fazla 50 karakter olabilir.")]
    public string Code { get; set; } = string.Empty;

    [StringLength(250, ErrorMessage = "Açıklama en fazla 250 karakter olabilir.")]
    public string? Description { get; set; }
}
