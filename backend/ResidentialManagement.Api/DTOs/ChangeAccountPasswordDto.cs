using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class ChangeAccountPasswordDto
{
    [Required(ErrorMessage = "Mevcut şifre alanı zorunludur.")]
    [StringLength(100, ErrorMessage = "Mevcut şifre en fazla 100 karakter olabilir.")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Yeni şifre alanı zorunludur.")]
    [MinLength(8, ErrorMessage = "Yeni şifre en az 8 karakter olmalıdır.")]
    [StringLength(100, ErrorMessage = "Yeni şifre en fazla 100 karakter olabilir.")]
    public string NewPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Yeni şifre tekrar alanı zorunludur.")]
    [MinLength(8, ErrorMessage = "Yeni şifre tekrar alanı en az 8 karakter olmalıdır.")]
    [StringLength(100, ErrorMessage = "Yeni şifre tekrar alanı en fazla 100 karakter olabilir.")]
    [Compare(nameof(NewPassword), ErrorMessage = "Yeni şifreler birbiriyle eşleşmiyor.")]
    public string ConfirmNewPassword { get; set; } = string.Empty;
}
