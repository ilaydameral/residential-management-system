using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IPasswordService _passwordService;
    private readonly IJwtTokenService _jwtTokenService;

    public AuthService(
        AppDbContext context,
        IPasswordService passwordService,
        IJwtTokenService jwtTokenService)
    {
        _context = context;
        _passwordService = passwordService;
        _jwtTokenService = jwtTokenService;
    }

    public async Task<LoginResponseDto> LoginAsync(LoginRequestDto loginDto)
    {
        var normalizedInput = loginDto.UserNameOrEmail.Trim().ToLower();

        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserName.ToLower() == normalizedInput || u.Email.ToLower() == normalizedInput);

        if (user is null || !_passwordService.VerifyPassword(user, user.PasswordHash, loginDto.Password, out var rehashNeeded))
        {
            throw new UnauthorizedException("Kullanıcı adı/e-posta veya parola hatalı.");
        }

        if (!user.IsActive)
        {
            throw new ForbiddenException("Kullanıcı hesabı pasif durumdadır.");
        }

        if (rehashNeeded)
        {
            user.PasswordHash = _passwordService.HashPassword(user, loginDto.Password);
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        var activeRoleCodes = user.UserRoles
            .Where(ur => ur.Role.IsActive)
            .Select(ur => ur.Role.Code)
            .Distinct()
            .ToList();

        var (token, expiresAtUtc) = _jwtTokenService.GenerateToken(user, activeRoleCodes);

        return new LoginResponseDto
        {
            AccessToken = token,
            ExpiresAtUtc = expiresAtUtc,
            User = new AuthenticatedUserDto
            {
                Id = user.Id,
                UserName = user.UserName,
                Email = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Roles = activeRoleCodes
            }
        };
    }

    public async Task<AuthenticatedUserDto> RegisterAsync(RegisterRequestDto registerDto)
    {
        var normalizedUserName = registerDto.UserName.Trim().ToLower();
        var normalizedEmail = registerDto.Email.Trim().ToLower();

        var existingUserName = await _context.Users.AnyAsync(u => u.UserName.ToLower() == normalizedUserName);
        if (existingUserName)
        {
            throw new InvalidOperationException("Bu kullanıcı adı zaten kullanılmaktadır.");
        }

        var existingEmail = await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail);
        if (existingEmail)
        {
            throw new InvalidOperationException("Bu e-posta adresi zaten kullanılmaktadır.");
        }

        var defaultRole = await _context.Roles.FirstOrDefaultAsync(r => r.Code == "USER");
        if (defaultRole is null)
        {
            throw new InvalidOperationException("Varsayılan kullanıcı rolü (USER) sistemde bulunamadı.");
        }

        var user = new User
        {
            UserName = registerDto.UserName.Trim(),
            Email = registerDto.Email.Trim(),
            FirstName = registerDto.FirstName.Trim(),
            LastName = registerDto.LastName.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        user.PasswordHash = _passwordService.HashPassword(user, registerDto.Password);

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var userRole = new UserRole
        {
            UserId = user.Id,
            RoleId = defaultRole.Id,
            AssignedAt = DateTime.UtcNow
        };

        _context.UserRoles.Add(userRole);
        await _context.SaveChangesAsync();

        return new AuthenticatedUserDto
        {
            Id = user.Id,
            UserName = user.UserName,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Roles = new List<string> { defaultRole.Code }
        };
    }
}
