using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public interface IJwtTokenService
{
    (string token, DateTime expiresAtUtc) GenerateToken(User user, IEnumerable<string> roles);
}
