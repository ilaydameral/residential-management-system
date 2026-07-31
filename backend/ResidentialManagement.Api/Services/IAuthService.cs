using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IAuthService
{
    Task<LoginResponseDto> LoginAsync(LoginRequestDto loginDto);
    Task<AuthenticatedUserDto> RegisterAsync(RegisterRequestDto registerDto);
}
