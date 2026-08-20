using System.Data;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class ExpenseService : IExpenseService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimePublisher _realtimePublisher;

    public ExpenseService(
        AppDbContext context,
        IManagerScopeService managerScopeService,
        INotificationService notificationService,
        IRealtimePublisher realtimePublisher)
    {
        _context = context;
        _managerScopeService = managerScopeService;
        _notificationService = notificationService;
        _realtimePublisher = realtimePublisher;
    }

    public async Task<List<ExpenseDto>> GetAllAsync(
        int currentUserId,
        bool isAdmin,
        int? propertyId,
        int? buildingId,
        string? category,
        bool? isCancelled,
        bool? isApportioned)
    {
        var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(currentUserId, isAdmin);
        var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(currentUserId, isAdmin);

        var query = _context.Expenses.AsNoTracking();

        if (propertyId.HasValue)
        {
            query = query.Where(e => e.PropertyId == propertyId.Value);
        }

        if (buildingId.HasValue)
        {
            query = query.Where(e => e.BuildingId == buildingId.Value);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalizedCategory = category.Trim().ToLower();
            query = query.Where(e => e.Category.ToLower() == normalizedCategory);
        }

        if (isCancelled.HasValue)
        {
            query = query.Where(e => e.IsCancelled == isCancelled.Value);
        }

        if (isApportioned.HasValue)
        {
            if (isApportioned.Value)
            {
                query = query.Where(e => e.UnitCharges.Any());
            }
            else
            {
                query = query.Where(e => !e.UnitCharges.Any());
            }
        }

        if (!isAdmin)
        {
            query = query.Where(e =>
                (e.BuildingId != null && accessibleBuildingIds.Contains(e.BuildingId.Value)) ||
                (e.BuildingId == null && accessiblePropertyIds.Contains(e.PropertyId)));
        }

        return await query
            .OrderByDescending(e => e.ExpenseDate)
            .ThenByDescending(e => e.Id)
            .Select(ToDtoExpression())
            .ToListAsync();
    }

    public async Task<ExpenseDto?> GetByIdAsync(int id, int currentUserId, bool isAdmin)
    {
        var expense = await _context.Expenses
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id);

        if (expense is null)
        {
            return null;
        }

        await EnsureCanViewScopeAsync(expense, currentUserId, isAdmin);

        return await _context.Expenses
            .AsNoTracking()
            .Where(e => e.Id == id)
            .Select(ToDtoExpression())
            .FirstOrDefaultAsync();
    }

    public async Task<ExpenseDto> CreateAsync(
        CreateExpenseDto createDto,
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

            var canAccessBuilding = await _managerScopeService.CanAccessBuildingAsync(currentUserId, building.Id, isAdmin);
            if (!canAccessBuilding)
            {
                throw new ForbiddenException("Bu blok üzerinde gider oluşturma yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            var canManageProperty = await _managerScopeService.CanManagePropertyAsync(currentUserId, property.Id, isAdmin);
            if (!canManageProperty)
            {
                throw new ForbiddenException("Bu yapı üzerinde site genelinde gider oluşturma yetkiniz bulunmamaktadır. Blok seviyesinde yöneticiler yapı geneli gider kaydı ekleyemez.");
            }
        }

        var expense = new Expense
        {
            PropertyId = property.Id,
            BuildingId = building?.Id,
            Title = createDto.Title.Trim(),
            Category = createDto.Category.Trim(),
            Amount = createDto.Amount,
            ExpenseDate = createDto.ExpenseDate,
            DocumentNumber = string.IsNullOrWhiteSpace(createDto.DocumentNumber) ? null : createDto.DocumentNumber.Trim(),
            VendorName = string.IsNullOrWhiteSpace(createDto.VendorName) ? null : createDto.VendorName.Trim(),
            Description = string.IsNullOrWhiteSpace(createDto.Description) ? null : createDto.Description.Trim(),
            AttachmentUrl = string.IsNullOrWhiteSpace(createDto.AttachmentUrl) ? null : createDto.AttachmentUrl.Trim(),
            IsCancelled = false,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = currentUserId
        };

        _context.Expenses.Add(expense);
        await _context.SaveChangesAsync();

        return await GetByIdAsync(expense.Id, currentUserId, isAdmin)
            ?? throw new InvalidOperationException("Gider oluşturuldu ancak bilgileri alınamadı.");
    }

    public async Task<ExpenseDto?> UpdateAsync(
        int id,
        UpdateExpenseDto updateDto,
        int currentUserId,
        bool isAdmin)
    {
        var expense = await _context.Expenses.FindAsync(id);
        if (expense is null)
        {
            return null;
        }

        await EnsureCanManageScopeAsync(expense, currentUserId, isAdmin);

        if (expense.IsCancelled)
        {
            throw new InvalidOperationException("İptal edilmiş bir gider kaydı güncellenemez.");
        }

        var isApportioned = await _context.UnitCharges.AnyAsync(uc => uc.ExpenseId == expense.Id);
        if (isApportioned)
        {
            throw new InvalidOperationException("Dairelere yansıtılmış/borçlandırılmış bir gider kaydı güncellenemez.");
        }

        expense.Title = updateDto.Title.Trim();
        expense.Category = updateDto.Category.Trim();
        expense.Amount = updateDto.Amount;
        expense.ExpenseDate = updateDto.ExpenseDate;
        expense.DocumentNumber = string.IsNullOrWhiteSpace(updateDto.DocumentNumber) ? null : updateDto.DocumentNumber.Trim();
        expense.VendorName = string.IsNullOrWhiteSpace(updateDto.VendorName) ? null : updateDto.VendorName.Trim();
        expense.Description = string.IsNullOrWhiteSpace(updateDto.Description) ? null : updateDto.Description.Trim();
        expense.AttachmentUrl = string.IsNullOrWhiteSpace(updateDto.AttachmentUrl) ? null : updateDto.AttachmentUrl.Trim();
        expense.UpdatedAt = DateTime.UtcNow;
        expense.UpdatedByUserId = currentUserId;

        await _context.SaveChangesAsync();

        return await GetByIdAsync(id, currentUserId, isAdmin);
    }

    public async Task<ExpenseDto?> CancelAsync(
        int id,
        CancelExpenseDto cancelDto,
        int currentUserId,
        bool isAdmin)
    {
        if (string.IsNullOrWhiteSpace(cancelDto.CancelReason))
        {
            throw new BadRequestException("İptal gerekçesi girmek zorunludur.");
        }

        var expense = await _context.Expenses.FindAsync(id);
        if (expense is null)
        {
            return null;
        }

        await EnsureCanManageScopeAsync(expense, currentUserId, isAdmin);

        if (expense.IsCancelled)
        {
            return await GetByIdAsync(id, currentUserId, isAdmin);
        }

        var isApportioned = await _context.UnitCharges.AnyAsync(uc => uc.ExpenseId == expense.Id);
        if (isApportioned)
        {
            throw new InvalidOperationException("Dairelere yansıtılmış/borçlandırılmış bir gider kaydı iptal edilemez.");
        }

        expense.IsCancelled = true;
        expense.CancelledAt = DateTime.UtcNow;
        expense.CancelledByUserId = currentUserId;
        expense.CancelReason = cancelDto.CancelReason.Trim();
        expense.UpdatedAt = DateTime.UtcNow;
        expense.UpdatedByUserId = currentUserId;

        await _context.SaveChangesAsync();

        return await GetByIdAsync(id, currentUserId, isAdmin);
    }

    public async Task<ExpenseApportionmentPreviewDto> GetApportionmentPreviewAsync(
        int expenseId,
        ApportionExpenseDto apportionDto,
        int currentUserId,
        bool isAdmin)
    {
        var expense = await _context.Expenses
            .Include(e => e.Property)
            .Include(e => e.Building)
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == expenseId);

        if (expense is null)
        {
            throw new KeyNotFoundException($"ID'si {expenseId} olan gider kaydı bulunamadı.");
        }

        await EnsureCanViewScopeAsync(expense, currentUserId, isAdmin);

        if (expense.IsCancelled)
        {
            throw new InvalidOperationException("İptal edilmiş bir gider dairelere yansıtılamaz.");
        }

        var isApportioned = await _context.UnitCharges.AnyAsync(uc => uc.ExpenseId == expense.Id);
        if (isApportioned)
        {
            throw new InvalidOperationException("Bu gider zaten dairelere yansıtılmıştır.");
        }

        var targets = await ResolveApportionmentTargetsAsync(expense, apportionDto, currentUserId, isAdmin);
        var totalAllocated = targets.Sum(t => t.Amount);

        return new ExpenseApportionmentPreviewDto
        {
            ExpenseId = expense.Id,
            ExpenseTitle = expense.Title,
            ExpenseAmount = expense.Amount,
            PropertyId = expense.PropertyId,
            PropertyName = expense.Property.Name,
            BuildingId = expense.BuildingId,
            BuildingName = expense.Building?.Name,
            Mode = apportionDto.Mode.Trim().ToUpper(),
            TargetUnitCount = targets.Count,
            TotalAllocatedAmount = totalAllocated,
            DueDate = apportionDto.DueDate,
            Items = targets.Select(t => new ExpenseApportionmentPreviewItemDto
            {
                UnitId = t.Unit.Id,
                BuildingName = t.Unit.Building.Name,
                UnitNumber = t.Unit.UnitNumber,
                Amount = t.Amount
            }).ToList()
        };
    }

    public async Task<ApportionExpenseResultDto> ApportionExpenseAsync(
        int expenseId,
        ApportionExpenseDto apportionDto,
        int currentUserId,
        bool isAdmin)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var expense = await _context.Expenses
            .Include(e => e.Property)
            .Include(e => e.Building)
            .FirstOrDefaultAsync(e => e.Id == expenseId);

        if (expense is null)
        {
            throw new KeyNotFoundException($"ID'si {expenseId} olan gider kaydı bulunamadı.");
        }

        await EnsureCanManageScopeAsync(expense, currentUserId, isAdmin);

        if (expense.IsCancelled)
        {
            throw new InvalidOperationException("İptal edilmiş bir gider dairelere yansıtılamaz.");
        }

        var isAlreadyApportioned = await _context.UnitCharges.AnyAsync(uc => uc.ExpenseId == expense.Id);
        if (isAlreadyApportioned)
        {
            throw new InvalidOperationException("Bu gider zaten dairelere yansıtılmıştır. Aynı gider ikinci kez borçlandırılamaz.");
        }

        var targets = await ResolveApportionmentTargetsAsync(expense, apportionDto, currentUserId, isAdmin);

        var utcNow = DateTime.UtcNow;
        var totalIssuedAmount = 0m;

        foreach (var (unit, amount) in targets)
        {
            var unitCharge = new UnitCharge
            {
                UnitId = unit.Id,
                ExpenseId = expense.Id,
                DuePeriodId = null,
                Title = $"{expense.Title} Gider Payı",
                Description = string.IsNullOrWhiteSpace(expense.VendorName)
                    ? $"{expense.Title} gider yansıtması"
                    : $"{expense.VendorName} - {expense.Title}",
                Amount = amount,
                DueDate = apportionDto.DueDate,
                ChargeType = "EXPENSE_RECOVERY",
                IsCancelled = false,
                CreatedAt = utcNow,
                CreatedByUserId = currentUserId
            };

            _context.UnitCharges.Add(unitCharge);
            totalIssuedAmount += amount;
        }

        expense.UpdatedAt = utcNow;
        expense.UpdatedByUserId = currentUserId;

        var targetUnitIds = targets.Select(t => t.Unit.Id).Distinct().ToList();
        var residentUserIds = await _context.UnitOccupancies
            .AsNoTracking()
            .Where(uo => targetUnitIds.Contains(uo.UnitId) && uo.IsActive && (uo.EndDate == null || uo.EndDate > utcNow))
            .Select(uo => uo.UserId)
            .Distinct()
            .ToListAsync();

        List<Notification> createdNotifications = new();
        if (residentUserIds.Count > 0)
        {
            createdNotifications = await _notificationService.AddNotificationEntitiesForUsersAsync(
                residentUserIds,
                $"Gider Payı Yansıtıldı: {expense.Title}",
                $"{expense.Title} gideri dairenize yansıtılmıştır. Son ödeme tarihi: {apportionDto.DueDate:dd.MM.yyyy}.",
                "FINANCE",
                "Expense",
                expense.Id);
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        if (createdNotifications.Count > 0)
        {
            var dtos = createdNotifications.Select(n => _notificationService.ToDto(n)).ToList();
            await _realtimePublisher.PublishNotificationsAsync(dtos);
        }

        return new ApportionExpenseResultDto
        {
            ExpenseId = expense.Id,
            ExpenseTitle = expense.Title,
            ApportionedAt = utcNow,
            GeneratedChargeCount = targets.Count,
            TotalApportionedAmount = totalIssuedAmount
        };
    }

    private async Task<List<(Unit Unit, decimal Amount)>> ResolveApportionmentTargetsAsync(
        Expense expense,
        ApportionExpenseDto dto,
        int currentUserId,
        bool isAdmin)
    {
        if (dto.DueDate.Date < expense.ExpenseDate.Date)
        {
            throw new BadRequestException("Son ödeme tarihi gider tarihinden önce olamaz.");
        }

        var mode = (dto.Mode ?? string.Empty).Trim().ToUpper();

        var baseUnitsQuery = _context.Units
            .Include(u => u.Building)
            .AsNoTracking()
            .Where(u => u.IsActive && u.Building.IsActive && u.Building.Property.IsActive);

        if (expense.BuildingId.HasValue)
        {
            baseUnitsQuery = baseUnitsQuery.Where(u => u.BuildingId == expense.BuildingId.Value);
        }
        else
        {
            baseUnitsQuery = baseUnitsQuery.Where(u => u.Building.PropertyId == expense.PropertyId);
        }

        if (mode == "EQUAL_SCOPE")
        {
            var units = await baseUnitsQuery
                .OrderBy(u => u.Building.Code)
                .ThenBy(u => u.UnitNumber)
                .ThenBy(u => u.Id)
                .ToListAsync();

            if (units.Count == 0)
            {
                throw new InvalidOperationException("Giderin kapsamında borçlandırılacak aktif bağımsız bölüm bulunamadı.");
            }

            return AllocateEqualAmounts(units, expense.Amount);
        }
        else if (mode == "EQUAL_SELECTED")
        {
            if (dto.SelectedUnitIds is null || dto.SelectedUnitIds.Count == 0)
            {
                throw new BadRequestException("Seçili daire listesi (SelectedUnitIds) boş olamaz.");
            }

            if (dto.SelectedUnitIds.Count != dto.SelectedUnitIds.Distinct().Count())
            {
                throw new BadRequestException("Aynı daire ID'si birden fazla kez gönderilemez.");
            }

            var unitsInScope = await baseUnitsQuery
                .Where(u => dto.SelectedUnitIds.Contains(u.Id))
                .ToListAsync();

            if (unitsInScope.Count != dto.SelectedUnitIds.Count)
            {
                throw new ForbiddenException("Seçilen dairelerden bazıları bu giderin aktif kapsamı içinde yer almamaktadır.");
            }

            foreach (var unitId in dto.SelectedUnitIds)
            {
                var canAccess = await _managerScopeService.CanAccessUnitAsync(currentUserId, unitId, isAdmin);
                if (!canAccess)
                {
                    throw new ForbiddenException($"ID'si {unitId} olan daire üzerinde yetkiniz bulunmamaktadır.");
                }
            }

            var orderedUnits = unitsInScope
                .OrderBy(u => u.Building.Code)
                .ThenBy(u => u.UnitNumber)
                .ThenBy(u => u.Id)
                .ToList();

            return AllocateEqualAmounts(orderedUnits, expense.Amount);
        }
        else if (mode == "MANUAL_SELECTED")
        {
            if (dto.ManualUnitApportionments is null || dto.ManualUnitApportionments.Count == 0)
            {
                throw new BadRequestException("Manuel daire borçlandırma listesi (ManualUnitApportionments) boş olamaz.");
            }

            var unitIds = dto.ManualUnitApportionments.Select(m => m.UnitId).ToList();
            if (unitIds.Count != unitIds.Distinct().Count())
            {
                throw new BadRequestException("Aynı daire ID'si birden fazla kez gönderilemez.");
            }

            if (dto.ManualUnitApportionments.Any(m => m.Amount <= 0))
            {
                throw new BadRequestException("Daireye yansıtılacak tutar 0'dan büyük olmalıdır.");
            }

            var manualTotal = dto.ManualUnitApportionments.Sum(m => m.Amount);
            if (manualTotal != expense.Amount)
            {
                throw new BadRequestException($"Girilen daire borçlarının toplamı ({manualTotal:N2} TL), gider tutarı ({expense.Amount:N2} TL) ile birebir eşit olmalıdır.");
            }

            var unitsInScope = await baseUnitsQuery
                .Where(u => unitIds.Contains(u.Id))
                .ToListAsync();

            if (unitsInScope.Count != unitIds.Count)
            {
                throw new ForbiddenException("Seçilen dairelerden bazıları bu giderin aktif kapsamı içinde yer almamaktadır.");
            }

            foreach (var unitId in unitIds)
            {
                var canAccess = await _managerScopeService.CanAccessUnitAsync(currentUserId, unitId, isAdmin);
                if (!canAccess)
                {
                    throw new ForbiddenException($"ID'si {unitId} olan daire üzerinde yetkiniz bulunmamaktadır.");
                }
            }

            var unitMap = unitsInScope.ToDictionary(u => u.Id);
            var result = new List<(Unit Unit, decimal Amount)>();

            foreach (var item in dto.ManualUnitApportionments)
            {
                result.Add((unitMap[item.UnitId], item.Amount));
            }

            return result;
        }
        else
        {
            throw new BadRequestException($"Geçersiz borçlandırma modu: '{dto.Mode}'. Geçerli modlar: EQUAL_SCOPE, EQUAL_SELECTED, MANUAL_SELECTED.");
        }
    }

    private static List<(Unit Unit, decimal Amount)> AllocateEqualAmounts(List<Unit> units, decimal totalExpenseAmount)
    {
        var count = units.Count;
        var baseAmount = Math.Floor((totalExpenseAmount / count) * 100m) / 100m;
        var baseSum = baseAmount * count;
        var remainderCents = (int)Math.Round((totalExpenseAmount - baseSum) * 100m);

        var result = new List<(Unit Unit, decimal Amount)>();

        for (int i = 0; i < count; i++)
        {
            var amount = baseAmount + (i < remainderCents ? 0.01m : 0.00m);
            result.Add((units[i], amount));
        }

        return result;
    }

    private async Task EnsureCanViewScopeAsync(Expense expense, int currentUserId, bool isAdmin)
    {
        if (isAdmin) return;

        if (expense.BuildingId.HasValue)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(currentUserId, expense.BuildingId.Value, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu bloğa ait gider kaydını görüntüleme yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            var canView = await _managerScopeService.CanViewPropertyAsync(currentUserId, expense.PropertyId, isAdmin);
            if (!canView)
            {
                throw new ForbiddenException("Bu yapıya ait gider kaydını görüntüleme yetkiniz bulunmamaktadır.");
            }
        }
    }

    private async Task EnsureCanManageScopeAsync(Expense expense, int currentUserId, bool isAdmin)
    {
        if (isAdmin) return;

        if (expense.BuildingId.HasValue)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(currentUserId, expense.BuildingId.Value, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu bloğa ait gider kaydını yönetme yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            var canManage = await _managerScopeService.CanManagePropertyAsync(currentUserId, expense.PropertyId, isAdmin);
            if (!canManage)
            {
                throw new ForbiddenException("Bu yapı genelindeki gider kaydını yönetme yetkiniz bulunmamaktadır. Yalnızca site geneli yöneticiler bu işlemi yapabilir.");
            }
        }
    }

    private static System.Linq.Expressions.Expression<Func<Expense, ExpenseDto>> ToDtoExpression()
    {
        return e => new ExpenseDto
        {
            Id = e.Id,
            PropertyId = e.PropertyId,
            PropertyName = e.Property.Name,
            BuildingId = e.BuildingId,
            BuildingName = e.Building == null ? null : e.Building.Name,
            Title = e.Title,
            Category = e.Category,
            Amount = e.Amount,
            ExpenseDate = e.ExpenseDate,
            DocumentNumber = e.DocumentNumber,
            VendorName = e.VendorName,
            Description = e.Description,
            AttachmentUrl = e.AttachmentUrl,
            IsCancelled = e.IsCancelled,
            CancelledAt = e.CancelledAt,
            CancelledByFullName = e.CancelledByUser == null ? null : (e.CancelledByUser.FirstName + " " + e.CancelledByUser.LastName).Trim(),
            CancelReason = e.CancelReason,
            IsApportioned = e.UnitCharges.Any(),
            ApportionedChargeCount = e.UnitCharges.Count,
            CreatedAt = e.CreatedAt,
            CreatedByFullName = (e.CreatedByUser.FirstName + " " + e.CreatedByUser.LastName).Trim(),
            UpdatedAt = e.UpdatedAt,
            UpdatedByFullName = e.UpdatedByUser == null ? null : (e.UpdatedByUser.FirstName + " " + e.UpdatedByUser.LastName).Trim()
        };
    }
}
