using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class RegisterRequestDto
{
    [Required(ErrorMessage = "Kullanıcı adı alanı zorunludur.")]
    [StringLength(50, ErrorMessage = "Kullanıcı adı en fazla 50 karakter olabilir.")]
    public string UserName { get; set; } = string.Empty;

    [Required(ErrorMessage = "E-posta alanı zorunludur.")]
    [EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi giriniz.")]
    [StringLength(150, ErrorMessage = "E-posta adresi en fazla 150 karakter olabilir.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Parola alanı zorunludur.")]
    [MinLength(8, ErrorMessage = "Parola en az 8 karakter olmalıdır.")]
    [StringLength(100, ErrorMessage = "Parola en fazla 100 karakter olabilir.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Ad alanı zorunludur.")]
    [StringLength(75, ErrorMessage = "Ad en fazla 75 karakter olabilir.")]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Soyad alanı zorunludur.")]
    [StringLength(75, ErrorMessage = "Soyad en fazla 75 karakter olabilir.")]
    public string LastName { get; set; } = string.Empty;
}
