namespace ResidentialManagement.Api.DTOs;

public class LoginResponseDto
{
    public string AccessToken { get; set; } = string.Empty;

    public DateTime ExpiresAtUtc { get; set; }

    public AuthenticatedUserDto User { get; set; } = null!;
}
