using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class DueDefinitionService : IDueDefinitionService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;

    public DueDefinitionService(
        AppDbContext context,
        IManagerScopeService managerScopeService)
    {
        _context = context;
        _managerScopeService = managerScopeService;
    }

    public async Task<List<DueDefinitionDto>> GetAllAsync(
        int currentUserId,
        bool isAdmin,
        int? propertyId,
        int? buildingId,
        bool? isActive)
    {
        var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(currentUserId, isAdmin);
        var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(currentUserId, isAdmin);

        var query = _context.DueDefinitions.AsNoTracking();

        if (propertyId.HasValue)
        {
            query = query.Where(dd => dd.PropertyId == propertyId.Value);
        }

        if (buildingId.HasValue)
        {
            query = query.Where(dd => dd.BuildingId == buildingId.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(dd => dd.IsActive == isActive.Value);
        }

        // Scope filter for non-admin:
        if (!isAdmin)
        {
            query = query.Where(dd =>
                (dd.BuildingId != null && accessibleBuildingIds.Contains(dd.BuildingId.Value)) ||
                (dd.BuildingId == null && accessiblePropertyIds.Contains(dd.PropertyId)));
        }

        return await query
            .OrderByDescending(dd => dd.IsActive)
            .ThenBy(dd => dd.Title)
            .Select(ToDtoExpression())
            .ToListAsync();
    }

    public async Task<DueDefinitionDto?> GetByIdAsync(int id, int currentUserId, bool isAdmin)
    {
        var definition = await _context.DueDefinitions
            .AsNoTracking()
            .FirstOrDefaultAsync(dd => dd.Id == id);

        if (definition is null)
        {
            return null;
        }

        await EnsureCanViewScopeAsync(definition, currentUserId, isAdmin);

        return await _context.DueDefinitions
            .AsNoTracking()
            .Where(dd => dd.Id == id)
            .Select(ToDtoExpression())
            .FirstOrDefaultAsync();
    }

    public async Task<DueDefinitionDto> CreateAsync(
        CreateDueDefinitionDto createDto,
        int currentUserId,
        bool isAdmin)
    {
        var property = await _context.Properties.FindAsync(createDto.PropertyId);
        if (property is null || !property.IsActive)
        {
            throw new KeyNotFoundException($"ID'si {createDto.PropertyId} olan aktif bir yapı bulunamadı.");
        }

        Building? building = null;
        if (createDto.BuildingId.HasValue)
        {
            building = await _context.Buildings.FindAsync(createDto.BuildingId.Value);
            if (building is null || !building.IsActive)
            {
                throw new KeyNotFoundException($"ID'si {createDto.BuildingId.Value} olan aktif bir blok bulunamadı.");
            }

            if (building.PropertyId != property.Id)
            {
                throw new BadRequestException("Seçilen blok belirtilen yapıya ait değildir.");
            }

            // Building-level scope check:
            var canAccessBuilding = await _managerScopeService.CanAccessBuildingAsync(currentUserId, building.Id, isAdmin);
            if (!canAccessBuilding)
            {
                throw new ForbiddenException("Bu blok üzerinde aidat tanımı oluşturma yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            // Property-level scope check (Requires property-level manager assignment):
            var canManageProperty = await _managerScopeService.CanManagePropertyAsync(currentUserId, property.Id, isAdmin);
            if (!canManageProperty)
            {
                throw new ForbiddenException("Bu yapı üzerinde site genelinde aidat tanımı oluşturma yetkiniz bulunmamaktadır. Blok seviyesinde yöneticiler yapı geneli aidat tanımlayamaz.");
            }
        }

        var definition = new DueDefinition
        {
            PropertyId = property.Id,
            BuildingId = building?.Id,
            Title = createDto.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(createDto.Description) ? null : createDto.Description.Trim(),
            Amount = createDto.Amount,
            DueDay = createDto.DueDay,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = currentUserId
        };

        _context.DueDefinitions.Add(definition);
        await _context.SaveChangesAsync();

        return await GetByIdAsync(definition.Id, currentUserId, isAdmin)
            ?? throw new InvalidOperationException("Aidat tanımı oluşturuldu ancak bilgileri alınamadı.");
    }

    public async Task<DueDefinitionDto?> UpdateAsync(
        int id,
        UpdateDueDefinitionDto updateDto,
        int currentUserId,
        bool isAdmin)
    {
        var definition = await _context.DueDefinitions.FindAsync(id);
        if (definition is null)
        {
            return null;
        }

        await EnsureCanManageScopeAsync(definition, currentUserId, isAdmin);

        definition.Title = updateDto.Title.Trim();
        definition.Description = string.IsNullOrWhiteSpace(updateDto.Description) ? null : updateDto.Description.Trim();
        definition.Amount = updateDto.Amount;
        definition.DueDay = updateDto.DueDay;
        definition.UpdatedAt = DateTime.UtcNow;
        definition.UpdatedByUserId = currentUserId;

        await _context.SaveChangesAsync();

        return await GetByIdAsync(id, currentUserId, isAdmin);
    }

    public async Task<DueDefinitionDto?> SetActiveAsync(
        int id,
        bool isActive,
        int currentUserId,
        bool isAdmin)
    {
        var definition = await _context.DueDefinitions.FindAsync(id);
        if (definition is null)
        {
            return null;
        }

        await EnsureCanManageScopeAsync(definition, currentUserId, isAdmin);

        definition.IsActive = isActive;
        definition.UpdatedAt = DateTime.UtcNow;
        definition.UpdatedByUserId = currentUserId;

        await _context.SaveChangesAsync();

        return await GetByIdAsync(id, currentUserId, isAdmin);
    }

    private async Task EnsureCanViewScopeAsync(DueDefinition definition, int currentUserId, bool isAdmin)
    {
        if (isAdmin) return;

        if (definition.BuildingId.HasValue)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(currentUserId, definition.BuildingId.Value, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu bloğa ait aidat tanımını görüntüleme yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            var canView = await _managerScopeService.CanViewPropertyAsync(currentUserId, definition.PropertyId, isAdmin);
            if (!canView)
            {
                throw new ForbiddenException("Bu yapıya ait aidat tanımını görüntüleme yetkiniz bulunmamaktadır.");
            }
        }
    }

    private async Task EnsureCanManageScopeAsync(DueDefinition definition, int currentUserId, bool isAdmin)
    {
        if (isAdmin) return;

        if (definition.BuildingId.HasValue)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(currentUserId, definition.BuildingId.Value, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu bloğa ait aidat tanımını düzenleme yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            var canManage = await _managerScopeService.CanManagePropertyAsync(currentUserId, definition.PropertyId, isAdmin);
            if (!canManage)
            {
                throw new ForbiddenException("Bu yapı genelindeki aidat tanımını düzenleme yetkiniz bulunmamaktadır. Yalnızca site geneli yöneticiler bu işlemi yapabilir.");
            }
        }
    }

    private static System.Linq.Expressions.Expression<Func<DueDefinition, DueDefinitionDto>> ToDtoExpression()
    {
        return dd => new DueDefinitionDto
        {
            Id = dd.Id,
            PropertyId = dd.PropertyId,
            PropertyName = dd.Property.Name,
            BuildingId = dd.BuildingId,
            BuildingName = dd.Building == null ? null : dd.Building.Name,
            Title = dd.Title,
            Description = dd.Description,
            Amount = dd.Amount,
            DueDay = dd.DueDay,
            IsActive = dd.IsActive,
            CreatedAt = dd.CreatedAt,
            CreatedByFullName = (dd.CreatedByUser.FirstName + " " + dd.CreatedByUser.LastName).Trim(),
            UpdatedAt = dd.UpdatedAt,
            UpdatedByFullName = dd.UpdatedByUser == null ? null : (dd.UpdatedByUser.FirstName + " " + dd.UpdatedByUser.LastName).Trim()
        };
    }
}
