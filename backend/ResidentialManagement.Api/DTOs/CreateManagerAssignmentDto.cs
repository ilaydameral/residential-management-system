using System.ComponentModel.DataAnnotations;

namespace ResidentialManagement.Api.DTOs;

public class CreateManagerAssignmentDto
{
    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir yönetici seçilmelidir.")]
    public int ManagerUserId { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir yapı seçilmelidir.")]
    public int PropertyId { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Geçerli bir blok seçilmelidir.")]
    public int? BuildingId { get; set; }
}
