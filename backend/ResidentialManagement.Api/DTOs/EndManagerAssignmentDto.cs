using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class EndManagerAssignmentDto
{
    [StringLength(500, ErrorMessage = "Sonlandırma nedeni en fazla 500 karakter olabilir.")]
    public string? EndReason { get; set; }
}
