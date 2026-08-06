using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class CancelExpenseDto
{
    [Required(ErrorMessage = "İptal gerekçesi girmek zorunludur.")]
    [StringLength(500, MinimumLength = 3, ErrorMessage = "İptal gerekçesi 3 ile 500 karakter arasında olmalıdır.")]
    public string CancelReason { get; set; } = string.Empty;
}
