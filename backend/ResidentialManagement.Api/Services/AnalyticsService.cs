using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class AnalyticsService : IAnalyticsService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;

    public AnalyticsService(AppDbContext context, IManagerScopeService managerScopeService)
    {
        _context = context;
        _managerScopeService = managerScopeService;
    }

    public async Task<FinanceAnalyticsDto> GetFinanceAsync(
        int userId, bool isAdmin, int? propertyId, int? buildingId, DateTime? fromDate, DateTime? toDate)
    {
        var range = AnalyticsCalculations.ResolveRange(fromDate, toDate, DateTime.UtcNow.Date);
        var previousRange = AnalyticsCalculations.ResolvePreviousRange(range);
        var scope = await ResolveScopeAsync(userId, isAdmin, propertyId, buildingId, includePropertyWideExpenses: true);

        var scopedCharges = ApplyUnitChargeScope(_context.UnitCharges.AsNoTracking(), scope)
            .Where(charge => !charge.IsCancelled);
        var charges = scopedCharges
            .Where(charge => charge.DueDate >= range.From && charge.DueDate < range.ToExclusive);

        var chargeBalances = charges.Select(charge => new
        {
            charge.Amount,
            charge.DueDate,
            charge.Unit.BuildingId,
            BuildingName = charge.Unit.Building.Name,
            Paid = charge.Payments
                .Where(payment => !payment.IsCancelled && payment.PaymentDate < range.ToExclusive)
                .Sum(payment => (decimal?)payment.Amount) ?? 0m
        });

        var overdueCutoff = range.ToExclusive < DateTime.UtcNow.Date
            ? range.ToExclusive
            : DateTime.UtcNow.Date;
        var chargeSummary = await chargeBalances
            .GroupBy(_ => 1)
            .Select(group => new
            {
                TotalCharged = group.Sum(item => item.Amount),
                OutstandingAmount = group.Sum(item => item.Amount > item.Paid ? item.Amount - item.Paid : 0m),
                OverdueChargeCount = group.Count(item => item.DueDate < overdueCutoff && item.Amount > item.Paid),
                OverdueAmount = group.Sum(item =>
                    item.DueDate < overdueCutoff && item.Amount > item.Paid ? item.Amount - item.Paid : 0m)
            })
            .FirstOrDefaultAsync();
        var totalCharged = chargeSummary?.TotalCharged ?? 0m;
        var outstandingAmount = chargeSummary?.OutstandingAmount ?? 0m;
        var overdueChargeCount = chargeSummary?.OverdueChargeCount ?? 0;
        var overdueAmount = chargeSummary?.OverdueAmount ?? 0m;

        var scopedPayments = ApplyPaymentScope(_context.Payments.AsNoTracking(), scope)
            .Where(payment => !payment.IsCancelled && !payment.UnitCharge.IsCancelled);
        var payments = scopedPayments
            .Where(payment => payment.PaymentDate >= range.From && payment.PaymentDate < range.ToExclusive);
        var totalCollected = await payments.SumAsync(payment => (decimal?)payment.Amount) ?? 0m;

        var scopedExpenses = ApplyExpenseScope(_context.Expenses.AsNoTracking(), scope)
            .Where(expense => !expense.IsCancelled);
        var expenses = scopedExpenses
            .Where(expense => expense.ExpenseDate >= range.From && expense.ExpenseDate < range.ToExclusive);
        var totalExpenses = await expenses.SumAsync(expense => (decimal?)expense.Amount) ?? 0m;

        var previousTotalCharged = await scopedCharges
            .Where(charge => charge.DueDate >= previousRange.From && charge.DueDate < previousRange.ToExclusive)
            .SumAsync(charge => (decimal?)charge.Amount) ?? 0m;
        var previousTotalCollected = await scopedPayments
            .Where(payment => payment.PaymentDate >= previousRange.From &&
                              payment.PaymentDate < previousRange.ToExclusive)
            .SumAsync(payment => (decimal?)payment.Amount) ?? 0m;
        var previousTotalExpenses = await scopedExpenses
            .Where(expense => expense.ExpenseDate >= previousRange.From &&
                              expense.ExpenseDate < previousRange.ToExclusive)
            .SumAsync(expense => (decimal?)expense.Amount) ?? 0m;

        var chargeTrend = await charges
            .GroupBy(charge => new { charge.DueDate.Year, charge.DueDate.Month })
            .Select(group => new { group.Key.Year, group.Key.Month, Amount = group.Sum(item => item.Amount) })
            .ToListAsync();
        var collectionTrend = await payments
            .GroupBy(payment => new { payment.PaymentDate.Year, payment.PaymentDate.Month })
            .Select(group => new { group.Key.Year, group.Key.Month, Amount = group.Sum(item => item.Amount) })
            .ToListAsync();

        var trendKeys = chargeTrend.Select(item => (item.Year, item.Month))
            .Concat(collectionTrend.Select(item => (item.Year, item.Month)))
            .Distinct()
            .OrderBy(item => item.Year)
            .ThenBy(item => item.Month);
        var trend = trendKeys.Select(key => new FinanceTrendPointDto
        {
            Period = $"{key.Year:D4}-{key.Month:D2}",
            Charged = chargeTrend.FirstOrDefault(item => item.Year == key.Year && item.Month == key.Month)?.Amount ?? 0m,
            Collected = collectionTrend.FirstOrDefault(item => item.Year == key.Year && item.Month == key.Month)?.Amount ?? 0m
        }).ToList();

        var expenseByCategory = await expenses
            .GroupBy(expense => expense.Category)
            .Select(group => new AmountBreakdownDto { Key = group.Key, Amount = group.Sum(item => item.Amount) })
            .OrderByDescending(item => item.Amount)
            .ToListAsync();

        var outstandingByBuilding = await chargeBalances
            .GroupBy(item => new { item.BuildingId, item.BuildingName })
            .Select(group => new BuildingAmountBreakdownDto
            {
                BuildingId = group.Key.BuildingId,
                BuildingName = group.Key.BuildingName,
                Amount = group.Sum(item => item.Amount > item.Paid ? item.Amount - item.Paid : 0m)
            })
            .Where(item => item.Amount > 0m)
            .OrderByDescending(item => item.Amount)
            .Take(10)
            .ToListAsync();

        var collectionRate = AnalyticsCalculations.CalculateCollectionRate(totalCharged, outstandingAmount);

        return new FinanceAnalyticsDto
        {
            FromDate = range.From,
            ToDate = range.ToInclusive,
            TotalCharged = totalCharged,
            TotalCollected = totalCollected,
            OutstandingAmount = outstandingAmount,
            CollectionRate = collectionRate,
            OverdueChargeCount = overdueChargeCount,
            OverdueAmount = overdueAmount,
            TotalExpenses = totalExpenses,
            NetCashPosition = totalCollected - totalExpenses,
            TotalAssessedComparison = AnalyticsCalculations.BuildComparison(totalCharged, previousTotalCharged),
            TotalCollectedComparison = AnalyticsCalculations.BuildComparison(totalCollected, previousTotalCollected),
            TotalExpensesComparison = AnalyticsCalculations.BuildComparison(totalExpenses, previousTotalExpenses),
            Trend = trend,
            ExpenseByCategory = expenseByCategory,
            OutstandingByBuilding = outstandingByBuilding
        };
    }

    public async Task<MaintenanceAnalyticsDto> GetMaintenanceAsync(
        int userId, bool isAdmin, int? propertyId, int? buildingId, DateTime? fromDate, DateTime? toDate)
    {
        var range = AnalyticsCalculations.ResolveRange(fromDate, toDate, DateTime.UtcNow.Date);
        var previousRange = AnalyticsCalculations.ResolvePreviousRange(range);
        var scope = await ResolveScopeAsync(userId, isAdmin, propertyId, buildingId);
        var scopedRequests = ApplyMaintenanceScope(_context.MaintenanceRequests.AsNoTracking(), scope);
        var requests = scopedRequests
            .Where(request => request.CreatedAt >= range.From && request.CreatedAt < range.ToExclusive);

        var requestSummary = await requests
            .GroupBy(_ => 1)
            .Select(group => new
            {
                TotalRequests = group.Count(),
                OpenBacklog = group.Count(request => request.Status == "OPEN"),
                InProgress = group.Count(request => request.Status == "IN_PROGRESS"),
                ResolvedOrClosed = group.Count(request => request.Status == "RESOLVED" || request.Status == "CLOSED"),
                HighOrEmergency = group.Count(request => request.Priority == "HIGH" || request.Priority == "EMERGENCY")
            })
            .FirstOrDefaultAsync();

        var averageResolutionMinutes = await requests
            .Where(request => (request.Status == "RESOLVED" || request.Status == "CLOSED") &&
                              (request.ResolvedAt != null || request.ClosedAt != null) &&
                              (request.ResolvedAt ?? request.ClosedAt) >= request.CreatedAt)
            .AverageAsync(request => (double?)EF.Functions.DateDiffMinute(
                request.CreatedAt, request.ResolvedAt ?? request.ClosedAt));

        var previousRequests = scopedRequests
            .Where(request => request.CreatedAt >= previousRange.From &&
                              request.CreatedAt < previousRange.ToExclusive);
        var previousTotalRequests = await previousRequests.CountAsync();
        var previousAverageResolutionMinutes = await previousRequests
            .Where(request => (request.Status == "RESOLVED" || request.Status == "CLOSED") &&
                              (request.ResolvedAt != null || request.ClosedAt != null) &&
                              (request.ResolvedAt ?? request.ClosedAt) >= request.CreatedAt)
            .AverageAsync(request => (double?)EF.Functions.DateDiffMinute(
                request.CreatedAt, request.ResolvedAt ?? request.ClosedAt));

        var averageResolutionHoursExact = AnalyticsCalculations.ResolutionHoursFromMinutes(averageResolutionMinutes);
        var previousAverageResolutionHoursExact =
            AnalyticsCalculations.ResolutionHoursFromMinutes(previousAverageResolutionMinutes);
        decimal? averageResolutionHours = averageResolutionHoursExact.HasValue
            ? Math.Round(averageResolutionHoursExact.Value, 1)
            : null;

        var byCategory = await requests
            .GroupBy(request => request.Category)
            .Select(group => new CountBreakdownDto { Key = group.Key, Count = group.Count() })
            .OrderByDescending(item => item.Count)
            .ToListAsync();
        var byStatus = await requests
            .GroupBy(request => request.Status)
            .Select(group => new CountBreakdownDto { Key = group.Key, Count = group.Count() })
            .OrderByDescending(item => item.Count)
            .ToListAsync();
        var trend = await requests
            .GroupBy(request => new { request.CreatedAt.Year, request.CreatedAt.Month, request.CreatedAt.Day })
            .Select(group => new { group.Key.Year, group.Key.Month, group.Key.Day, Count = group.Count() })
            .OrderBy(item => item.Year).ThenBy(item => item.Month).ThenBy(item => item.Day)
            .ToListAsync();
        var topBuildings = await requests
            .GroupBy(request => new { request.BuildingId, request.Building.Name })
            .Select(group => new BuildingCountBreakdownDto
            {
                BuildingId = group.Key.BuildingId,
                BuildingName = group.Key.Name,
                Count = group.Count()
            })
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.BuildingName)
            .Take(8)
            .ToListAsync();

        return new MaintenanceAnalyticsDto
        {
            FromDate = range.From,
            ToDate = range.ToInclusive,
            TotalRequests = requestSummary?.TotalRequests ?? 0,
            OpenBacklog = requestSummary?.OpenBacklog ?? 0,
            InProgress = requestSummary?.InProgress ?? 0,
            ResolvedOrClosed = requestSummary?.ResolvedOrClosed ?? 0,
            HighOrEmergency = requestSummary?.HighOrEmergency ?? 0,
            AverageResolutionHours = averageResolutionHours,
            TotalRequestsComparison = AnalyticsCalculations.BuildComparison(
                requestSummary?.TotalRequests ?? 0, previousTotalRequests),
            AverageResolutionHoursComparison = AnalyticsCalculations.BuildComparison(
                averageResolutionHoursExact, previousAverageResolutionHoursExact),
            ByCategory = byCategory,
            ByStatus = byStatus,
            Trend = trend.Select(item => new CountTrendPointDto
            {
                Period = $"{item.Year:D4}-{item.Month:D2}-{item.Day:D2}",
                Count = item.Count
            }).ToList(),
            TopBuildings = topBuildings
        };
    }

    public async Task<FacilityAnalyticsDto> GetFacilitiesAsync(
        int userId, bool isAdmin, int? propertyId, int? buildingId, DateTime? fromDate, DateTime? toDate)
    {
        var range = AnalyticsCalculations.ResolveRange(fromDate, toDate, DateTime.UtcNow.Date);
        var previousRange = AnalyticsCalculations.ResolvePreviousRange(range);
        var scope = await ResolveScopeAsync(userId, isAdmin, propertyId, buildingId);
        var scopedReservations = ApplyReservationScope(_context.FacilityReservations.AsNoTracking(), scope);
        var reservations = scopedReservations
            .Where(reservation => reservation.StartTime >= range.From && reservation.StartTime < range.ToExclusive);

        var reservationSummary = await reservations
            .GroupBy(_ => 1)
            .Select(group => new
            {
                TotalReservations = group.Count(),
                ApprovedOrCompleted = group.Count(reservation =>
                    reservation.Status == "APPROVED" || reservation.Status == "COMPLETED"),
                Pending = group.Count(reservation => reservation.Status == "PENDING"),
                CancelledOrRejected = group.Count(reservation =>
                    reservation.Status == "CANCELLED" || reservation.Status == "REJECTED"),
                BookedMinutes = group
                    .Where(reservation => reservation.Status == "APPROVED" || reservation.Status == "COMPLETED")
                    .Sum(reservation => EF.Functions.DateDiffMinute(reservation.StartTime, reservation.EndTime))
            })
            .FirstOrDefaultAsync();

        var previousReservationSummary = await scopedReservations
            .Where(reservation => reservation.StartTime >= previousRange.From &&
                                  reservation.StartTime < previousRange.ToExclusive)
            .GroupBy(_ => 1)
            .Select(group => new
            {
                TotalReservations = group.Count(),
                BookedMinutes = group
                    .Where(reservation => reservation.Status == "APPROVED" || reservation.Status == "COMPLETED")
                    .Sum(reservation => EF.Functions.DateDiffMinute(reservation.StartTime, reservation.EndTime))
            })
            .FirstOrDefaultAsync();

        var byFacility = await reservations
            .GroupBy(reservation => new { reservation.FacilityId, reservation.Facility.Name })
            .Select(group => new
            {
                group.Key.FacilityId,
                FacilityName = group.Key.Name,
                ReservationCount = group.Count(),
                BookedMinutes = group
                    .Where(item => item.Status == "APPROVED" || item.Status == "COMPLETED")
                    .Sum(item => EF.Functions.DateDiffMinute(item.StartTime, item.EndTime))
            })
            .OrderByDescending(item => item.ReservationCount)
            .ThenBy(item => item.FacilityName)
            .Take(10)
            .ToListAsync();
        var byStatus = await reservations
            .GroupBy(reservation => reservation.Status)
            .Select(group => new CountBreakdownDto { Key = group.Key, Count = group.Count() })
            .OrderByDescending(item => item.Count)
            .ToListAsync();
        var trend = await reservations
            .GroupBy(reservation => new { reservation.StartTime.Year, reservation.StartTime.Month, reservation.StartTime.Day })
            .Select(group => new { group.Key.Year, group.Key.Month, group.Key.Day, Count = group.Count() })
            .OrderBy(item => item.Year).ThenBy(item => item.Month).ThenBy(item => item.Day)
            .ToListAsync();

        var bookedHoursExact = (reservationSummary?.BookedMinutes ?? 0) / 60m;
        var previousBookedHoursExact = (previousReservationSummary?.BookedMinutes ?? 0) / 60m;
        var bookedHours = Math.Round(bookedHoursExact, 1);

        return new FacilityAnalyticsDto
        {
            FromDate = range.From,
            ToDate = range.ToInclusive,
            TotalReservations = reservationSummary?.TotalReservations ?? 0,
            ApprovedOrCompleted = reservationSummary?.ApprovedOrCompleted ?? 0,
            Pending = reservationSummary?.Pending ?? 0,
            CancelledOrRejected = reservationSummary?.CancelledOrRejected ?? 0,
            BookedHours = bookedHours,
            TotalReservationsComparison = AnalyticsCalculations.BuildComparison(
                reservationSummary?.TotalReservations ?? 0,
                previousReservationSummary?.TotalReservations ?? 0),
            BookedHoursComparison = AnalyticsCalculations.BuildComparison(
                bookedHoursExact, previousBookedHoursExact),
            ByFacility = byFacility.Select(item => new FacilityUsageBreakdownDto
            {
                FacilityId = item.FacilityId,
                FacilityName = item.FacilityName,
                ReservationCount = item.ReservationCount,
                BookedHours = Math.Round(item.BookedMinutes / 60m, 1)
            }).ToList(),
            ByStatus = byStatus,
            Trend = trend.Select(item => new CountTrendPointDto
            {
                Period = $"{item.Year:D4}-{item.Month:D2}-{item.Day:D2}",
                Count = item.Count
            }).ToList()
        };
    }

    private async Task<AnalyticsScope> ResolveScopeAsync(
        int userId, bool isAdmin, int? propertyId, int? buildingId, bool includePropertyWideExpenses = false)
    {
        if (propertyId.HasValue && !await _context.Properties.AsNoTracking().AnyAsync(item => item.Id == propertyId.Value))
            throw new NotFoundException("Seçilen yapı bulunamadı.");

        if (!isAdmin && propertyId.HasValue &&
            !await _managerScopeService.CanViewPropertyAsync(userId, propertyId.Value, false))
            throw new ForbiddenException("Seçilen yapı için analytics erişiminiz bulunmamaktadır.");

        int? resolvedPropertyId = propertyId;
        if (buildingId.HasValue)
        {
            var building = await _context.Buildings.AsNoTracking()
                .Where(item => item.Id == buildingId.Value)
                .Select(item => new { item.Id, item.PropertyId })
                .FirstOrDefaultAsync();
            if (building is null) throw new NotFoundException("Seçilen blok veya bina bulunamadı.");

            if (!isAdmin &&
                !await _managerScopeService.CanAccessBuildingAsync(userId, buildingId.Value, false))
                throw new ForbiddenException("Seçilen blok için analytics erişiminiz bulunmamaktadır.");

            if (propertyId.HasValue && building.PropertyId != propertyId.Value)
                throw new BadRequestException("Seçilen blok belirtilen yapıya ait değildir.");
            resolvedPropertyId = building.PropertyId;
        }

        if (!isAdmin && !propertyId.HasValue && resolvedPropertyId.HasValue)
        {
            if (!await _managerScopeService.CanViewPropertyAsync(userId, resolvedPropertyId.Value, false))
                throw new ForbiddenException("Seçilen yapı için analytics erişiminiz bulunmamaktadır.");
        }

        var accessibleBuildingIds = isAdmin
            ? new List<int>()
            : await _managerScopeService.GetAccessibleBuildingIdsAsync(userId, false);
        var propertyWideExpenseIds = !isAdmin && includePropertyWideExpenses
            ? await _managerScopeService.GetManageablePropertyIdsAsync(userId, false)
            : new List<int>();

        return new AnalyticsScope(
            isAdmin, resolvedPropertyId, buildingId, accessibleBuildingIds, propertyWideExpenseIds);
    }

    private static IQueryable<UnitCharge> ApplyUnitChargeScope(IQueryable<UnitCharge> query, AnalyticsScope scope)
    {
        if (scope.BuildingId.HasValue) return query.Where(item => item.Unit.BuildingId == scope.BuildingId.Value);
        if (scope.IsAdmin)
            return scope.PropertyId.HasValue
                ? query.Where(item => item.Unit.Building.PropertyId == scope.PropertyId.Value)
                : query;
        return query.Where(item => scope.AccessibleBuildingIds.Contains(item.Unit.BuildingId));
    }

    private static IQueryable<Payment> ApplyPaymentScope(IQueryable<Payment> query, AnalyticsScope scope)
    {
        if (scope.BuildingId.HasValue) return query.Where(item => item.UnitCharge.Unit.BuildingId == scope.BuildingId.Value);
        if (scope.IsAdmin)
            return scope.PropertyId.HasValue
                ? query.Where(item => item.UnitCharge.Unit.Building.PropertyId == scope.PropertyId.Value)
                : query;
        return query.Where(item => scope.AccessibleBuildingIds.Contains(item.UnitCharge.Unit.BuildingId));
    }

    private static IQueryable<Expense> ApplyExpenseScope(IQueryable<Expense> query, AnalyticsScope scope)
    {
        if (scope.BuildingId.HasValue) return query.Where(item => item.BuildingId == scope.BuildingId.Value);
        if (scope.IsAdmin)
            return scope.PropertyId.HasValue ? query.Where(item => item.PropertyId == scope.PropertyId.Value) : query;
        return query.Where(item =>
            (item.BuildingId.HasValue && scope.AccessibleBuildingIds.Contains(item.BuildingId.Value)) ||
            (!item.BuildingId.HasValue && scope.PropertyWideExpensePropertyIds.Contains(item.PropertyId)));
    }

    private static IQueryable<MaintenanceRequest> ApplyMaintenanceScope(
        IQueryable<MaintenanceRequest> query, AnalyticsScope scope)
    {
        if (scope.BuildingId.HasValue) return query.Where(item => item.BuildingId == scope.BuildingId.Value);
        if (scope.IsAdmin)
            return scope.PropertyId.HasValue ? query.Where(item => item.PropertyId == scope.PropertyId.Value) : query;
        return query.Where(item => scope.AccessibleBuildingIds.Contains(item.BuildingId));
    }

    private static IQueryable<FacilityReservation> ApplyReservationScope(
        IQueryable<FacilityReservation> query, AnalyticsScope scope)
    {
        if (scope.BuildingId.HasValue) return query.Where(item => item.Unit.BuildingId == scope.BuildingId.Value);
        if (scope.IsAdmin)
            return scope.PropertyId.HasValue
                ? query.Where(item => item.Facility.PropertyId == scope.PropertyId.Value)
                : query;
        return query.Where(item => scope.AccessibleBuildingIds.Contains(item.Unit.BuildingId));
    }

    private sealed record AnalyticsScope(
        bool IsAdmin,
        int? PropertyId,
        int? BuildingId,
        List<int> AccessibleBuildingIds,
        List<int> PropertyWideExpensePropertyIds);
}
