using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class ApprovePaymentSubmissionDto
{
    [StringLength(100, ErrorMessage = "İşlem referansı en fazla 100 karakter olabilir.")]
    public string? TransactionReference { get; set; }

    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir.")]
    public string? Notes { get; set; }
}
