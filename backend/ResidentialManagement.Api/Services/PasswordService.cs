using Microsoft.AspNetCore.Identity;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public class PasswordService : IPasswordService
{
    private readonly IPasswordHasher<User> _passwordHasher;

    public PasswordService(IPasswordHasher<User> passwordHasher)
    {
        _passwordHasher = passwordHasher;
    }

    public string HashPassword(User user, string password)
    {
        return _passwordHasher.HashPassword(user, password);
    }

    public bool VerifyPassword(User user, string hashedPassword, string providedPassword, out bool rehashNeeded)
    {
        var result = _passwordHasher.VerifyHashedPassword(user, hashedPassword, providedPassword);
        rehashNeeded = result == PasswordVerificationResult.SuccessRehashNeeded;
        return result == PasswordVerificationResult.Success || result == PasswordVerificationResult.SuccessRehashNeeded;
    }

    public bool VerifyPassword(User user, string hashedPassword, string providedPassword)
    {
        return VerifyPassword(user, hashedPassword, providedPassword, out _);
    }
}
