using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace ResidentialManagement.Api.IntegrationTests.Infrastructure;

internal static class TestJwtTokenFactory
{
    internal static string Create(int userId, string role, DateTime? expiresAt = null)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(CustomWebApplicationFactory.JwtKey)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            CustomWebApplicationFactory.JwtIssuer,
            CustomWebApplicationFactory.JwtAudience,
            [
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, $"integration-user-{userId}"),
                new Claim(ClaimTypes.Role, role)
            ],
            notBefore: expiresAt.HasValue && expiresAt.Value <= DateTime.UtcNow
                ? expiresAt.Value.AddMinutes(-10)
                : DateTime.UtcNow.AddMinutes(-1),
            expires: expiresAt ?? DateTime.UtcNow.AddMinutes(30),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
