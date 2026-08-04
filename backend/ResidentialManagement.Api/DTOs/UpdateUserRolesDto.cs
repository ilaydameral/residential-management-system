using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class UpdateUserRolesDto
{
    [Required(ErrorMessage = "En az bir rol seçilmelidir.")]
    [MinLength(1, ErrorMessage = "En az bir rol seçilmelidir.")]
    public List<string> RoleCodes { get; set; } = new();
}
