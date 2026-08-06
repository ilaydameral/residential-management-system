using System.Data;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class DuePeriodService : IDuePeriodService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;

    public DuePeriodService(
        AppDbContext context,
        IManagerScopeService managerScopeService)
    {
        _context = context;
        _managerScopeService = managerScopeService;
    }

    public async Task<List<DuePeriodDto>> GetAllAsync(
        int currentUserId,
        bool isAdmin,
        int? dueDefinitionId,
        int? year,
        int? month,
        string? status)
    {
        var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(currentUserId, isAdmin);
        var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(currentUserId, isAdmin);

        var query = _context.DuePeriods.AsNoTracking();

        if (dueDefinitionId.HasValue)
        {
            query = query.Where(dp => dp.DueDefinitionId == dueDefinitionId.Value);
        }

        if (year.HasValue)
        {
            query = query.Where(dp => dp.Year == year.Value);
        }

        if (month.HasValue)
        {
            query = query.Where(dp => dp.Month == month.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpperInvariant();
            query = query.Where(dp => dp.Status == normalizedStatus);
        }

        if (!isAdmin)
        {
            query = query.Where(dp =>
                (dp.DueDefinition.BuildingId != null && accessibleBuildingIds.Contains(dp.DueDefinition.BuildingId.Value)) ||
                (dp.DueDefinition.BuildingId == null && accessiblePropertyIds.Contains(dp.DueDefinition.PropertyId)));
        }

        return await query
            .OrderByDescending(dp => dp.Year)
            .ThenByDescending(dp => dp.Month)
            .ThenBy(dp => dp.Id)
            .Select(ToDtoExpression())
            .ToListAsync();
    }

    public async Task<DuePeriodDto?> GetByIdAsync(int id, int currentUserId, bool isAdmin)
    {
        var period = await _context.DuePeriods
            .Include(dp => dp.DueDefinition)
            .AsNoTracking()
            .FirstOrDefaultAsync(dp => dp.Id == id);

        if (period is null)
        {
            return null;
        }

        await EnsureCanViewScopeAsync(period.DueDefinition, currentUserId, isAdmin);

        return await _context.DuePeriods
            .AsNoTracking()
            .Where(dp => dp.Id == id)
            .Select(ToDtoExpression())
            .FirstOrDefaultAsync();
    }

    public async Task<DuePeriodDto> CreateDraftPeriodAsync(
        CreateDraftDuePeriodDto createDto,
        int currentUserId,
        bool isAdmin)
    {
        var definition = await _context.DueDefinitions
            .Include(dd => dd.Property)
            .Include(dd => dd.Building)
            .FirstOrDefaultAsync(dd => dd.Id == createDto.DueDefinitionId);

        if (definition is null)
        {
            throw new KeyNotFoundException($"ID'si {createDto.DueDefinitionId} olan aidat tanımı bulunamadı.");
        }

        if (!definition.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir aidat tanımından aidat dönemi oluşturulamaz.");
        }

        await EnsureCanManageScopeAsync(definition, currentUserId, isAdmin);

        // Check duplicate active period for same (DueDefinitionId, Year, Month)
        var exists = await _context.DuePeriods.AnyAsync(dp =>
            dp.DueDefinitionId == definition.Id &&
            dp.Year == createDto.Year &&
            dp.Month == createDto.Month &&
            dp.Status != "CANCELLED");

        if (exists)
        {
            throw new InvalidOperationException("Bu aidat tanımı için belirtilen dönemde (Yıl/Ay) zaten aktif veya taslak bir aidat dönemi bulunmaktadır.");
        }

        var daysInMonth = DateTime.DaysInMonth(createDto.Year, createDto.Month);
        var targetDay = Math.Min(definition.DueDay, daysInMonth);
        var dueDate = new DateTime(createDto.Year, createDto.Month, targetDay, 23, 59, 59, DateTimeKind.Utc);

        var monthNames = new[] { "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık" };
        var periodName = $"{createDto.Year} - {monthNames[createDto.Month]}";

        var period = new DuePeriod
        {
            DueDefinitionId = definition.Id,
            Year = createDto.Year,
            Month = createDto.Month,
            PeriodName = periodName,
            UnitAmount = definition.Amount, // Snapshot amount!
            DueDate = dueDate,
            Status = "DRAFT",
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = currentUserId
        };

        _context.DuePeriods.Add(period);
        await _context.SaveChangesAsync();

        return await GetByIdAsync(period.Id, currentUserId, isAdmin)
            ?? throw new InvalidOperationException("Aidat dönemi oluşturuldu ancak bilgileri alınamadı.");
    }

    public async Task<IssuePeriodPreviewDto> GetIssuePreviewAsync(
        int periodId,
        int currentUserId,
        bool isAdmin)
    {
        var period = await _context.DuePeriods
            .Include(dp => dp.DueDefinition)
                .ThenInclude(dd => dd.Property)
            .Include(dp => dp.DueDefinition)
                .ThenInclude(dd => dd.Building)
            .AsNoTracking()
            .FirstOrDefaultAsync(dp => dp.Id == periodId);

        if (period is null)
        {
            throw new KeyNotFoundException($"ID'si {periodId} olan aidat dönemi bulunamadı.");
        }

        await EnsureCanViewScopeAsync(period.DueDefinition, currentUserId, isAdmin);

        if (period.Status != "DRAFT")
        {
            throw new InvalidOperationException("Yalnızca DRAFT durumundaki aidat dönemleri için yayınlama önizlemesi alınabilir.");
        }

        var targetUnitsQuery = GetTargetUnitsQuery(period.DueDefinition);
        var targetUnitCount = await targetUnitsQuery.CountAsync();
        var totalExpectedAmount = targetUnitCount * period.UnitAmount;

        return new IssuePeriodPreviewDto
        {
            PeriodId = period.Id,
            PeriodName = period.PeriodName,
            DueDefinitionId = period.DueDefinitionId,
            DueDefinitionTitle = period.DueDefinition.Title,
            PropertyId = period.DueDefinition.PropertyId,
            PropertyName = period.DueDefinition.Property.Name,
            BuildingId = period.DueDefinition.BuildingId,
            BuildingName = period.DueDefinition.Building?.Name,
            TargetUnitCount = targetUnitCount,
            UnitDuesAmount = period.UnitAmount,
            TotalExpectedAmount = totalExpectedAmount,
            DueDate = period.DueDate
        };
    }

    public async Task<IssuePeriodResultDto> IssuePeriodAsync(
        int periodId,
        int currentUserId,
        bool isAdmin)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var period = await _context.DuePeriods
            .Include(dp => dp.DueDefinition)
            .FirstOrDefaultAsync(dp => dp.Id == periodId);

        if (period is null)
        {
            throw new KeyNotFoundException($"ID'si {periodId} olan aidat dönemi bulunamadı.");
        }

        if (!period.DueDefinition.IsActive)
        {
            throw new InvalidOperationException("Pasif durumdaki bir aidat tanımına ait dönem yayınlanamaz.");
        }

        await EnsureCanManageScopeAsync(period.DueDefinition, currentUserId, isAdmin);

        if (period.Status != "DRAFT")
        {
            throw new InvalidOperationException("Yalnızca DRAFT durumundaki aidat dönemleri yayınlanabilir.");
        }

        var alreadyHasCharges = await _context.UnitCharges.AnyAsync(uc => uc.DuePeriodId == period.Id);
        if (alreadyHasCharges)
        {
            throw new InvalidOperationException("Bu aidat dönemi için zaten borç tahakkukları oluşturulmuştur.");
        }

        var targetUnits = await GetTargetUnitsQuery(period.DueDefinition)
            .Select(u => u.Id)
            .ToListAsync();

        if (targetUnits.Count == 0)
        {
            throw new InvalidOperationException("Bu aidat dönemi için borçlandırılacak aktif bağımsız bölüm bulunamadı.");
        }

        var utcNow = DateTime.UtcNow;
        foreach (var unitId in targetUnits)
        {
            var unitCharge = new UnitCharge
            {
                UnitId = unitId,
                DuePeriodId = period.Id,
                ExpenseId = null,
                Title = $"{period.PeriodName} Aidat Borcu",
                Description = $"{period.DueDefinition.Title} borçlandırması",
                Amount = period.UnitAmount, // Snapshot amount!
                DueDate = period.DueDate,
                ChargeType = "DUES",
                IsCancelled = false,
                CreatedAt = utcNow,
                CreatedByUserId = currentUserId
            };

            _context.UnitCharges.Add(unitCharge);
        }

        period.Status = "ISSUED";
        period.IssuedAt = utcNow;
        period.IssuedByUserId = currentUserId;
        period.UpdatedAt = utcNow;

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return new IssuePeriodResultDto
        {
            PeriodId = period.Id,
            PeriodName = period.PeriodName,
            IssuedAt = utcNow,
            GeneratedChargeCount = targetUnits.Count,
            TotalIssuedAmount = targetUnits.Count * period.UnitAmount
        };
    }

    public async Task<DuePeriodDto?> CancelDraftPeriodAsync(
        int periodId,
        CancelDuePeriodDto cancelDto,
        int currentUserId,
        bool isAdmin)
    {
        if (string.IsNullOrWhiteSpace(cancelDto.CancellationReason))
        {
            throw new BadRequestException("İptal gerekçesi girmek zorunludur.");
        }

        var period = await _context.DuePeriods
            .Include(dp => dp.DueDefinition)
            .FirstOrDefaultAsync(dp => dp.Id == periodId);

        if (period is null)
        {
            return null;
        }

        await EnsureCanManageScopeAsync(period.DueDefinition, currentUserId, isAdmin);

        if (period.Status != "DRAFT")
        {
            throw new InvalidOperationException("Yalnızca DRAFT durumundaki aidat dönemleri iptal edilebilir. Yayınlanmış dönemler iptal edilemez.");
        }

        var utcNow = DateTime.UtcNow;
        period.Status = "CANCELLED";
        period.CancelledAt = utcNow;
        period.CancelledByUserId = currentUserId;
        period.CancellationReason = cancelDto.CancellationReason.Trim();
        period.UpdatedAt = utcNow;

        await _context.SaveChangesAsync();

        return await GetByIdAsync(period.Id, currentUserId, isAdmin);
    }

    private IQueryable<Unit> GetTargetUnitsQuery(DueDefinition definition)
    {
        var query = _context.Units
            .AsNoTracking()
            .Where(u => u.IsActive && u.Building.IsActive && u.Building.Property.IsActive);

        if (definition.BuildingId.HasValue)
        {
            query = query.Where(u => u.BuildingId == definition.BuildingId.Value);
        }
        else
        {
            query = query.Where(u => u.Building.PropertyId == definition.PropertyId);
        }

        return query;
    }

    private async Task EnsureCanViewScopeAsync(DueDefinition definition, int currentUserId, bool isAdmin)
    {
        if (isAdmin) return;

        if (definition.BuildingId.HasValue)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(currentUserId, definition.BuildingId.Value, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu bloğa ait aidat dönemini görüntüleme yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            var canView = await _managerScopeService.CanViewPropertyAsync(currentUserId, definition.PropertyId, isAdmin);
            if (!canView)
            {
                throw new ForbiddenException("Bu yapıya ait aidat dönemini görüntüleme yetkiniz bulunmamaktadır.");
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
                throw new ForbiddenException("Bu bloğa ait aidat dönemini yönetme yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            var canManage = await _managerScopeService.CanManagePropertyAsync(currentUserId, definition.PropertyId, isAdmin);
            if (!canManage)
            {
                throw new ForbiddenException("Bu yapı genelindeki aidat dönemini yönetme yetkiniz bulunmamaktadır. Yalnızca site geneli yöneticiler bu işlemi yapabilir.");
            }
        }
    }

    private static System.Linq.Expressions.Expression<Func<DuePeriod, DuePeriodDto>> ToDtoExpression()
    {
        return dp => new DuePeriodDto
        {
            Id = dp.Id,
            DueDefinitionId = dp.DueDefinitionId,
            DueDefinitionTitle = dp.DueDefinition.Title,
            PropertyId = dp.DueDefinition.PropertyId,
            PropertyName = dp.DueDefinition.Property.Name,
            BuildingId = dp.DueDefinition.BuildingId,
            BuildingName = dp.DueDefinition.Building == null ? null : dp.DueDefinition.Building.Name,
            Year = dp.Year,
            Month = dp.Month,
            PeriodName = dp.PeriodName,
            UnitAmount = dp.UnitAmount,
            DueDate = dp.DueDate,
            Status = dp.Status,
            IssuedAt = dp.IssuedAt,
            IssuedByFullName = dp.IssuedByUser == null ? null : (dp.IssuedByUser.FirstName + " " + dp.IssuedByUser.LastName).Trim(),
            CancelledAt = dp.CancelledAt,
            CancelledByFullName = dp.CancelledByUser == null ? null : (dp.CancelledByUser.FirstName + " " + dp.CancelledByUser.LastName).Trim(),
            CancellationReason = dp.CancellationReason,
            CreatedAt = dp.CreatedAt,
            CreatedByFullName = (dp.CreatedByUser.FirstName + " " + dp.CreatedByUser.LastName).Trim()
        };
    }
}
