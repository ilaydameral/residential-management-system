using System.Data;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class ManagerAssignmentService : IManagerAssignmentService
{
    private const string PropertyScope = "PROPERTY";
    private const string BuildingScope = "BUILDING";
    private const string PropertyReplacementReason = "Replaced by property-level assignment";

    private readonly AppDbContext _context;

    public ManagerAssignmentService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<ManagerAssignmentDto>> GetAllAsync(
        int? managerUserId,
        int? propertyId,
        int? buildingId,
        bool? isActive)
    {
        var query = _context.ManagerAssignments.AsNoTracking();

        if (managerUserId.HasValue)
        {
            query = query.Where(assignment => assignment.ManagerUserId == managerUserId.Value);
        }

        if (propertyId.HasValue)
        {
            query = query.Where(assignment => assignment.PropertyId == propertyId.Value);
        }

        if (buildingId.HasValue)
        {
            query = query.Where(assignment => assignment.BuildingId == buildingId.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(assignment => assignment.IsActive == isActive.Value);
        }

        return await query
            .OrderByDescending(assignment => assignment.IsActive)
            .ThenByDescending(assignment => assignment.AssignedAt)
            .ThenByDescending(assignment => assignment.Id)
            .Select(ToDtoExpression())
            .ToListAsync();
    }

    public async Task<ManagerAssignmentDto?> GetByIdAsync(int id)
    {
        return await _context.ManagerAssignments
            .AsNoTracking()
            .Where(assignment => assignment.Id == id)
            .Select(ToDtoExpression())
            .FirstOrDefaultAsync();
    }

    public async Task<ManagerAssignmentDto> CreateAsync(
        CreateManagerAssignmentDto createDto,
        int currentAdminUserId)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var manager = await _context.Users
            .Include(user => user.UserRoles)
                .ThenInclude(userRole => userRole.Role)
            .FirstOrDefaultAsync(user => user.Id == createDto.ManagerUserId);

        if (manager is null)
        {
            throw new KeyNotFoundException($"ID'si {createDto.ManagerUserId} olan kullanıcı bulunamadı.");
        }

        if (!manager.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir kullanıcı yönetici olarak atanamaz.");
        }

        var isManager = manager.UserRoles.Any(userRole =>
            userRole.Role.IsActive && userRole.Role.Code == AppRoles.Manager);
        if (!isManager)
        {
            throw new BadRequestException("Seçilen kullanıcı aktif MANAGER rolüne sahip değildir.");
        }

        var property = await _context.Properties
            .FirstOrDefaultAsync(item => item.Id == createDto.PropertyId);

        if (property is null)
        {
            throw new KeyNotFoundException($"ID'si {createDto.PropertyId} olan yapı bulunamadı.");
        }

        if (!property.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir yapıya yönetici atanamaz.");
        }

        Building? building = null;
        if (createDto.BuildingId.HasValue)
        {
            building = await _context.Buildings
                .FirstOrDefaultAsync(item => item.Id == createDto.BuildingId.Value);

            if (building is null)
            {
                throw new KeyNotFoundException($"ID'si {createDto.BuildingId.Value} olan blok bulunamadı.");
            }

            if (!building.IsActive)
            {
                throw new InvalidOperationException("Pasif durumdaki bir bloğa yönetici atanamaz.");
            }

            if (building.PropertyId != property.Id)
            {
                throw new BadRequestException("Seçilen blok belirtilen yapıya ait değildir.");
            }
        }

        var hasActivePropertyAssignment = await _context.ManagerAssignments.AnyAsync(assignment =>
            assignment.ManagerUserId == manager.Id &&
            assignment.PropertyId == property.Id &&
            assignment.BuildingId == null &&
            assignment.IsActive);

        if (hasActivePropertyAssignment)
        {
            throw new InvalidOperationException("Bu yönetici için seçilen yapıda zaten aktif bir yapı ataması bulunmaktadır.");
        }

        var utcNow = DateTime.UtcNow;
        if (building is not null)
        {
            var hasActiveBuildingAssignment = await _context.ManagerAssignments.AnyAsync(assignment =>
                assignment.ManagerUserId == manager.Id &&
                assignment.BuildingId == building.Id &&
                assignment.IsActive);

            if (hasActiveBuildingAssignment)
            {
                throw new InvalidOperationException("Bu yönetici için seçilen blokta zaten aktif bir blok ataması bulunmaktadır.");
            }
        }
        else
        {
            var activeBuildingAssignments = await _context.ManagerAssignments
                .Where(assignment =>
                    assignment.ManagerUserId == manager.Id &&
                    assignment.PropertyId == property.Id &&
                    assignment.BuildingId != null &&
                    assignment.IsActive)
                .ToListAsync();

            foreach (var assignment in activeBuildingAssignments)
            {
                assignment.IsActive = false;
                assignment.EndedAt = utcNow;
                assignment.EndedByUserId = currentAdminUserId;
                assignment.EndReason = PropertyReplacementReason;
            }
        }

        var managerAssignment = new ManagerAssignment
        {
            ManagerUserId = manager.Id,
            PropertyId = property.Id,
            BuildingId = building?.Id,
            AssignedAt = utcNow,
            AssignedByUserId = currentAdminUserId,
            IsActive = true
        };

        _context.ManagerAssignments.Add(managerAssignment);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return await GetByIdAsync(managerAssignment.Id)
            ?? throw new InvalidOperationException("Yönetici ataması oluşturuldu ancak bilgileri alınamadı.");
    }

    public async Task<ManagerAssignmentDto?> EndAsync(
        int id,
        EndManagerAssignmentDto endDto,
        int currentAdminUserId)
    {
        var assignment = await _context.ManagerAssignments
            .FirstOrDefaultAsync(item => item.Id == id);

        if (assignment is null)
        {
            return null;
        }

        if (!assignment.IsActive)
        {
            throw new InvalidOperationException("Bu yönetici ataması zaten sonlandırılmıştır.");
        }

        assignment.IsActive = false;
        assignment.EndedAt = DateTime.UtcNow;
        assignment.EndedByUserId = currentAdminUserId;
        assignment.EndReason = string.IsNullOrWhiteSpace(endDto.EndReason)
            ? null
            : endDto.EndReason.Trim();

        await _context.SaveChangesAsync();

        return await GetByIdAsync(assignment.Id)
            ?? throw new InvalidOperationException("Yönetici ataması sonlandırıldı ancak bilgileri alınamadı.");
    }

    private static System.Linq.Expressions.Expression<Func<ManagerAssignment, ManagerAssignmentDto>> ToDtoExpression()
    {
        return assignment => new ManagerAssignmentDto
        {
            Id = assignment.Id,
            ManagerUserId = assignment.ManagerUserId,
            ManagerUserName = assignment.ManagerUser.UserName,
            ManagerFullName = (assignment.ManagerUser.FirstName + " " + assignment.ManagerUser.LastName).Trim(),
            ManagerEmail = assignment.ManagerUser.Email,
            PropertyId = assignment.PropertyId,
            PropertyName = assignment.Property.Name,
            BuildingId = assignment.BuildingId,
            BuildingName = assignment.Building == null ? null : assignment.Building.Name,
            BuildingCode = assignment.Building == null ? null : assignment.Building.Code,
            ScopeType = assignment.BuildingId == null ? PropertyScope : BuildingScope,
            AssignedAt = assignment.AssignedAt,
            AssignedByUserId = assignment.AssignedByUserId,
            AssignedByFullName = (assignment.AssignedByUser.FirstName + " " + assignment.AssignedByUser.LastName).Trim(),
            IsActive = assignment.IsActive,
            EndedAt = assignment.EndedAt,
            EndedByUserId = assignment.EndedByUserId,
            EndedByFullName = assignment.EndedByUser == null
                ? null
                : (assignment.EndedByUser.FirstName + " " + assignment.EndedByUser.LastName).Trim(),
            EndReason = assignment.EndReason
        };
    }
}
