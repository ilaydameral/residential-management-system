using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Services;

public interface IAdminInitializer
{
    Task InitializeAsync();
}

public class AdminInitializer : IAdminInitializer
{
    private readonly AppDbContext _context;
    private readonly IPasswordService _passwordService;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _env;
    private readonly ILogger<AdminInitializer> _logger;

    public AdminInitializer(
        AppDbContext context,
        IPasswordService passwordService,
        IConfiguration configuration,
        IHostEnvironment env,
        ILogger<AdminInitializer> logger)
    {
        _context = context;
        _passwordService = passwordService;
        _configuration = configuration;
        _env = env;
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        if (!_env.IsDevelopment())
        {
            return;
        }

        var userName = _configuration["BootstrapAdmin:UserName"]?.Trim();
        var email = _configuration["BootstrapAdmin:Email"]?.Trim();
        var password = _configuration["BootstrapAdmin:Password"];
        var firstName = _configuration["BootstrapAdmin:FirstName"]?.Trim() ?? "System";
        var lastName = _configuration["BootstrapAdmin:LastName"]?.Trim() ?? "Administrator";

        if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            _logger.LogInformation("BootstrapAdmin configuration is incomplete. Skipping development admin user creation.");
            return;
        }

        var existingUser = await _context.Users
            .AnyAsync(u => u.UserName.ToLower() == userName.ToLower() || u.Email.ToLower() == email.ToLower());

        if (existingUser)
        {
            _logger.LogInformation("Bootstrap admin user '{UserName}' ({Email}) already exists. Skipping initialization.", userName, email);
            return;
        }

        var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.Code == "ADMIN");
        if (adminRole is null)
        {
            _logger.LogWarning("ADMIN role not found in database. Cannot create bootstrap admin user.");
            return;
        }

        var adminUser = new User
        {
            UserName = userName,
            Email = email,
            FirstName = firstName,
            LastName = lastName,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        adminUser.PasswordHash = _passwordService.HashPassword(adminUser, password);

        _context.Users.Add(adminUser);
        await _context.SaveChangesAsync();

        var userRole = new UserRole
        {
            UserId = adminUser.Id,
            RoleId = adminRole.Id,
            AssignedAt = DateTime.UtcNow
        };

        _context.UserRoles.Add(userRole);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Development bootstrap admin user '{UserName}' ({Email}) successfully created.", userName, email);
    }
}
