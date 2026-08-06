using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class UpdateExpenseDto
{
    [Required(ErrorMessage = "Gider başlığı zorunludur.")]
    [StringLength(150, ErrorMessage = "Başlık en fazla 150 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Kategori alanı zorunludur.")]
    [StringLength(50, ErrorMessage = "Kategori en fazla 50 karakter olabilir.")]
    public string Category { get; set; } = string.Empty;

    [Range(0.01, 999999999.99, ErrorMessage = "Gider tutarı 0'dan büyük olmalıdır.")]
    public decimal Amount { get; set; }

    [Required(ErrorMessage = "Gider tarihi zorunludur.")]
    public DateTime ExpenseDate { get; set; }

    [StringLength(100, ErrorMessage = "Belge no en fazla 100 karakter olabilir.")]
    public string? DocumentNumber { get; set; }

    [StringLength(150, ErrorMessage = "Firma/Tedarikçi adı en fazla 150 karakter olabilir.")]
    public string? VendorName { get; set; }

    [StringLength(500, ErrorMessage = "Açıklama en fazla 500 karakter olabilir.")]
    public string? Description { get; set; }

    [StringLength(500, ErrorMessage = "Ek dosya bağlantısı en fazla 500 karakter olabilir.")]
    public string? AttachmentUrl { get; set; }
}
