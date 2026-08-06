using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class ApportionExpenseDto
{
    [Required(ErrorMessage = "Borçlandırma modu zorunludur.")]
    public string Mode { get; set; } = string.Empty; // "EQUAL_SCOPE", "EQUAL_SELECTED", "MANUAL_SELECTED"

    public List<int>? SelectedUnitIds { get; set; }

    public List<ManualUnitApportionmentItemDto>? ManualUnitApportionments { get; set; }

    [Required(ErrorMessage = "Son ödeme tarihi zorunludur.")]
    public DateTime DueDate { get; set; }
}
