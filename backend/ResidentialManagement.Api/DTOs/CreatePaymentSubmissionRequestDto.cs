using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class CreatePaymentSubmissionRequestDto
{
    [Required(ErrorMessage = "Borç seçimi (UnitChargeId) zorunludur.")]
    public int UnitChargeId { get; set; }

    [Range(0.01, 999999999.99, ErrorMessage = "Ödeme tutarı 0'dan büyük olmalıdır.")]
    public decimal Amount { get; set; }

    [Required(ErrorMessage = "Ödeme tarihi zorunludur.")]
    public DateTime PaymentDate { get; set; }

    [StringLength(50, ErrorMessage = "Ödeme yöntemi en fazla 50 karakter olabilir.")]
    public string? PaymentMethod { get; set; } = "BANK_TRANSFER";

    [StringLength(100, ErrorMessage = "Referans/Dekont no en fazla 100 karakter olabilir.")]
    public string? ReferenceCode { get; set; }

    [StringLength(500, ErrorMessage = "Açıklama en fazla 500 karakter olabilir.")]
    public string? UserNotes { get; set; }

    [Required(ErrorMessage = "Dekont dosyası yüklemek zorunludur.")]
    public IFormFile ReceiptFile { get; set; } = null!;
}
