using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class LoginRequestDto
{
    [Required(ErrorMessage = "Kullanıcı adı veya e-posta alanı zorunludur.")]
    [MaxLength(150, ErrorMessage = "Kullanıcı adı veya e-posta en fazla 150 karakter olabilir.")]
    public string UserNameOrEmail { get; set; } = string.Empty;

    [Required(ErrorMessage = "Parola alanı zorunludur.")]
    [MaxLength(100, ErrorMessage = "Parola en fazla 100 karakter olabilir.")]
    public string Password { get; set; } = string.Empty;
}
