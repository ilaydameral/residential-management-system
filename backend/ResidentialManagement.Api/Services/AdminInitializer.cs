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

        await InitializeAdminUserAsync();
        await InitializeDevRoleUserAsync("MANAGER", "manager", "manager@example.com", "Manager123!", "Operational", "Manager");
        await InitializeDevRoleUserAsync("USER", "user", "user@example.com", "User123!", "Standard", "User");
    }

    private async Task InitializeAdminUserAsync()
    {
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

        await CreateUserIfNotExistsAsync("ADMIN", userName, email, password, firstName, lastName);
    }

    private async Task InitializeDevRoleUserAsync(string roleCode, string defaultUserName, string defaultEmail, string defaultPassword, string firstName, string lastName)
    {
        var userName = _configuration[$"Bootstrap{roleCode}:UserName"]?.Trim() ?? defaultUserName;
        var email = _configuration[$"Bootstrap{roleCode}:Email"]?.Trim() ?? defaultEmail;
        var password = _configuration[$"Bootstrap{roleCode}:Password"] ?? defaultPassword;

        await CreateUserIfNotExistsAsync(roleCode, userName, email, password, firstName, lastName);
    }

    private async Task CreateUserIfNotExistsAsync(string roleCode, string userName, string email, string password, string firstName, string lastName)
    {
        var existingUser = await _context.Users
            .AnyAsync(u => u.UserName.ToLower() == userName.ToLower() || u.Email.ToLower() == email.ToLower());

        if (existingUser)
        {
            _logger.LogInformation("Bootstrap user '{UserName}' ({Email}) already exists. Skipping initialization.", userName, email);
            return;
        }

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Code == roleCode);
        if (role is null)
        {
            _logger.LogWarning("Role '{RoleCode}' not found in database. Cannot create bootstrap user.", roleCode);
            return;
        }

        var user = new User
        {
            UserName = userName,
            Email = email,
            FirstName = firstName,
            LastName = lastName,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        user.PasswordHash = _passwordService.HashPassword(user, password);

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var userRole = new UserRole
        {
            UserId = user.Id,
            RoleId = role.Id,
            AssignedAt = DateTime.UtcNow
        };

        _context.UserRoles.Add(userRole);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Development bootstrap user '{UserName}' ({Email}) with role '{RoleCode}' successfully created.", userName, email, roleCode);
    }
}
