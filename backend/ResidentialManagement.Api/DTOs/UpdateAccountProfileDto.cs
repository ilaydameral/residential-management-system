using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class UpdateAccountProfileDto
{
    [Required(ErrorMessage = "Ad soyad alanı zorunludur.")]
    [StringLength(151, MinimumLength = 3, ErrorMessage = "Ad soyad 3 ile 151 karakter arasında olmalıdır.")]
    public string FullName { get; set; } = string.Empty;
}
