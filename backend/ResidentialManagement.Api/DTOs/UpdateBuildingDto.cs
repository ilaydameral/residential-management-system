using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class UpdateBuildingDto
{
    [Required(ErrorMessage = "Gayrimenkul seçimi zorunludur.")]
    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir gayrimenkul seçilmelidir.")]
    public int PropertyId { get; set; }

    [Required(ErrorMessage = "Bina adı zorunludur.")]
    [StringLength(150, ErrorMessage = "Bina adı en fazla 150 karakter olabilir.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Bina kodu zorunludur.")]
    [StringLength(50, ErrorMessage = "Bina kodu en fazla 50 karakter olabilir.")]
    public string Code { get; set; } = string.Empty;

    [Required(ErrorMessage = "Kat sayısı zorunludur.")]
    [Range(1, 200, ErrorMessage = "Kat sayısı 1 ile 200 arasında olmalıdır.")]
    public int FloorCount { get; set; }

    [StringLength(500, ErrorMessage = "Açıklama en fazla 500 karakter olabilir.")]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
}
