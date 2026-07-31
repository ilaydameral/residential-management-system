using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public interface IPasswordService
{
    string HashPassword(User user, string password);
    bool VerifyPassword(User user, string hashedPassword, string providedPassword, out bool rehashNeeded);
    bool VerifyPassword(User user, string hashedPassword, string providedPassword);
}
