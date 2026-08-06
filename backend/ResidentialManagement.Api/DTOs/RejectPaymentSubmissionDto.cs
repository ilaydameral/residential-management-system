using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class RejectPaymentSubmissionDto
{
    [Required(ErrorMessage = "Red gerekçesi girmek zorunludur.")]
    [StringLength(500, MinimumLength = 3, ErrorMessage = "Red gerekçesi 3 ile 500 karakter arasında olmalıdır.")]
    public string RejectionReason { get; set; } = string.Empty;
}
