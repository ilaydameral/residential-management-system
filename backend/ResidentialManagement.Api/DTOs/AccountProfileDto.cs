namespace ResidentialManagement.Api.DTOs;

public class AccountProfileDto
{
    public int Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public List<string> Roles { get; set; } = new();

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }
}
