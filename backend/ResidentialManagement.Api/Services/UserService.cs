using System.Data;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class UserService : IUserService
{
    private const int MaximumResultCount = 20;
    private readonly AppDbContext _context;
    private readonly IPasswordService _passwordService;

    public UserService(AppDbContext context, IPasswordService passwordService)
    {
        _context = context;
        _passwordService = passwordService;
    }

    public async Task<List<UserManagementDto>> GetAllAsync(
        string? search,
        string? role,
        bool? isActive)
    {
        var query = _context.Users.AsNoTracking();
        var normalizedSearch = search?.Trim();
        var normalizedRole = role?.Trim().ToUpperInvariant();

        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            query = query.Where(user =>
                user.FirstName.Contains(normalizedSearch) ||
                user.LastName.Contains(normalizedSearch) ||
                user.Email.Contains(normalizedSearch));
        }

        if (!string.IsNullOrWhiteSpace(normalizedRole))
        {
            query = query.Where(user => user.UserRoles.Any(userRole =>
                userRole.Role.IsActive && userRole.Role.Code == normalizedRole));
        }

        if (isActive.HasValue)
        {
            query = query.Where(user => user.IsActive == isActive.Value);
        }

        var utcNow = DateTime.UtcNow;
        return await query
            .OrderBy(user => user.FirstName)
            .ThenBy(user => user.LastName)
            .ThenBy(user => user.Id)
            .Select(user => new UserManagementDto
            {
                Id = user.Id,
                FullName = (user.FirstName + " " + user.LastName).Trim(),
                Email = user.Email,
                Roles = user.UserRoles
                    .Where(userRole => userRole.Role.IsActive)
                    .OrderBy(userRole => userRole.RoleId)
                    .Select(userRole => userRole.Role.Code)
                    .ToList(),
                IsActive = user.IsActive,
                ActiveUnitCount = user.UnitOccupancies
                    .Where(occupancy =>
                        occupancy.IsActive &&
                        occupancy.StartDate <= utcNow &&
                        (!occupancy.EndDate.HasValue || occupancy.EndDate.Value >= utcNow) &&
                        occupancy.Unit.IsActive &&
                        occupancy.Unit.Building.IsActive &&
                        occupancy.Unit.Building.Property.IsActive)
                    .Select(occupancy => occupancy.UnitId)
                    .Distinct()
                    .Count(),
                CreatedAt = user.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<List<UserSearchResultDto>> SearchAsync(
        string query,
        bool includeInactive = false)
    {
        var normalizedQuery = query?.Trim() ?? string.Empty;
        if (normalizedQuery.Length < 2)
        {
            throw new BadRequestException("Kullanıcı araması için en az 2 karakter girilmelidir.");
        }

        var users = _context.Users
            .AsNoTracking()
            .Where(u =>
                u.FirstName.Contains(normalizedQuery) ||
                u.LastName.Contains(normalizedQuery) ||
                u.Email.Contains(normalizedQuery));

        if (!includeInactive)
        {
            users = users.Where(u => u.IsActive);
        }

        return await users
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .ThenBy(u => u.Id)
            .Select(u => new UserSearchResultDto
            {
                Id = u.Id,
                FullName = (u.FirstName + " " + u.LastName).Trim(),
                Email = u.Email,
                IsActive = u.IsActive
            })
            .Take(MaximumResultCount)
            .ToListAsync();
    }

    public async Task<UserDetailDto?> GetDetailAsync(int id)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(user => user.Id == id)
            .Select(user => new UserDetailDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                Roles = user.UserRoles
                    .Where(userRole => userRole.Role.IsActive)
                    .OrderBy(userRole => userRole.RoleId)
                    .Select(userRole => userRole.Role.Code)
                    .ToList(),
                IsActive = user.IsActive
            })
            .FirstOrDefaultAsync();
    }

    public async Task<AccountProfileDto?> GetCurrentProfileAsync(int id)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(user => user.Id == id)
            .Select(user => new AccountProfileDto
            {
                Id = user.Id,
                FullName = (user.FirstName + " " + user.LastName).Trim(),
                Email = user.Email,
                Roles = user.UserRoles
                    .Where(userRole => userRole.Role.IsActive)
                    .OrderBy(userRole => userRole.RoleId)
                    .Select(userRole => userRole.Role.Code)
                    .ToList(),
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt
            })
            .FirstOrDefaultAsync();
    }

    public async Task<UserManagementDto> CreateAsync(CreateManagedUserDto createDto)
    {
        var normalizedEmail = createDto.Email.Trim().ToLowerInvariant();
        if (await _context.Users.AnyAsync(user =>
            user.Email.ToLower() == normalizedEmail ||
            user.UserName.ToLower() == normalizedEmail))
        {
            throw new InvalidOperationException("Bu e-posta adresi zaten kullanılmaktadır.");
        }

        var roles = await GetValidRolesAsync(createDto.RoleCodes);
        var utcNow = DateTime.UtcNow;
        var user = new User
        {
            UserName = normalizedEmail,
            Email = normalizedEmail,
            FirstName = createDto.FirstName.Trim(),
            LastName = createDto.LastName.Trim(),
            IsActive = createDto.IsActive,
            CreatedAt = utcNow
        };
        user.PasswordHash = _passwordService.HashPassword(user, createDto.Password);

        foreach (var role in roles)
        {
            user.UserRoles.Add(new UserRole
            {
                User = user,
                Role = role,
                AssignedAt = utcNow
            });
        }

        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return await GetByIdAsync(user.Id) ?? throw new InvalidOperationException("Kullanıcı oluşturuldu ancak bilgileri alınamadı.");
    }

    public async Task<UserManagementDto?> UpdateAsync(int id, UpdateManagedUserDto updateDto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user is null)
        {
            return null;
        }

        var normalizedEmail = updateDto.Email.Trim().ToLowerInvariant();
        if (await _context.Users.AnyAsync(other =>
            other.Id != id && other.Email.ToLower() == normalizedEmail))
        {
            throw new InvalidOperationException("Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.");
        }

        user.FirstName = updateDto.FirstName.Trim();
        user.LastName = updateDto.LastName.Trim();
        user.Email = normalizedEmail;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<UserManagementDto?> SetActiveAsync(int id, bool isActive, int currentUserId)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var user = await _context.Users
            .Include(item => item.UserRoles)
                .ThenInclude(userRole => userRole.Role)
            .FirstOrDefaultAsync(item => item.Id == id);

        if (user is null)
        {
            return null;
        }

        if (!isActive && id == currentUserId)
        {
            throw new InvalidOperationException("Kendi kullanıcı hesabınızı pasif duruma getiremezsiniz.");
        }

        if (!isActive && user.IsActive && HasActiveAdminRole(user))
        {
            await EnsureAnotherActiveAdminExistsAsync(id);
        }

        user.IsActive = isActive;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return await GetByIdAsync(id);
    }

    public async Task<UserManagementDto?> UpdateRolesAsync(
        int id,
        UpdateUserRolesDto updateDto,
        int currentUserId)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var user = await _context.Users
            .Include(item => item.UserRoles)
                .ThenInclude(userRole => userRole.Role)
            .FirstOrDefaultAsync(item => item.Id == id);

        if (user is null)
        {
            return null;
        }

        var roles = await GetValidRolesAsync(updateDto.RoleCodes);
        var keepsAdminRole = roles.Any(role => role.Code == AppRoles.Admin);
        var currentlyAdmin = HasActiveAdminRole(user);

        if (id == currentUserId && currentlyAdmin && !keepsAdminRole)
        {
            throw new InvalidOperationException("Kendi Yönetici rolünüzü kaldıramazsınız.");
        }

        if (user.IsActive && currentlyAdmin && !keepsAdminRole)
        {
            await EnsureAnotherActiveAdminExistsAsync(id);
        }

        var assignedAt = DateTime.UtcNow;
        var desiredRoleIds = roles.Select(role => role.Id).ToHashSet();
        var removedRoles = user.UserRoles
            .Where(userRole => !desiredRoleIds.Contains(userRole.RoleId))
            .ToList();
        _context.UserRoles.RemoveRange(removedRoles);

        var existingRoleIds = user.UserRoles.Select(userRole => userRole.RoleId).ToHashSet();
        foreach (var role in roles.Where(role => !existingRoleIds.Contains(role.Id)))
        {
            _context.UserRoles.Add(new UserRole
            {
                UserId = user.Id,
                RoleId = role.Id,
                AssignedAt = assignedAt
            });
        }

        user.UpdatedAt = assignedAt;
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return await GetByIdAsync(id);
    }

    private async Task<UserManagementDto?> GetByIdAsync(int id)
    {
        var users = await GetAllAsync(null, null, null);
        return users.FirstOrDefault(user => user.Id == id);
    }

    private async Task<List<Role>> GetValidRolesAsync(IEnumerable<string>? roleCodes)
    {
        var normalizedCodes = (roleCodes ?? Array.Empty<string>())
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim().ToUpperInvariant())
            .Distinct()
            .ToList();

        if (normalizedCodes.Count == 0)
        {
            throw new BadRequestException("Kullanıcıya en az bir rol atanmalıdır.");
        }

        var roles = await _context.Roles
            .Where(role => role.IsActive && normalizedCodes.Contains(role.Code))
            .ToListAsync();

        if (roles.Count != normalizedCodes.Count)
        {
            throw new BadRequestException("Seçilen rollerden biri geçersiz veya pasif durumdadır.");
        }

        return roles;
    }

    private static bool HasActiveAdminRole(User user)
    {
        return user.UserRoles.Any(userRole =>
            userRole.Role.IsActive && userRole.Role.Code == AppRoles.Admin);
    }

    private async Task EnsureAnotherActiveAdminExistsAsync(int excludedUserId)
    {
        var anotherAdminExists = await _context.Users.AnyAsync(user =>
            user.Id != excludedUserId &&
            user.IsActive &&
            user.UserRoles.Any(userRole =>
                userRole.Role.IsActive && userRole.Role.Code == AppRoles.Admin));

        if (!anotherAdminExists)
        {
            throw new InvalidOperationException("Sistemdeki son aktif Yönetici pasif yapılamaz veya Yönetici rolü kaldırılamaz.");
        }
    }
}
