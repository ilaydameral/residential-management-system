using System.Globalization;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public class FinancialReportingService : IFinancialReportingService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;

    private static readonly CultureInfo TurkishCulture = new("tr-TR");

    public FinancialReportingService(AppDbContext context, IManagerScopeService managerScopeService)
    {
        _context = context;
        _managerScopeService = managerScopeService;
    }

    public async Task<ManagementFinanceSummaryDto> GetManagementSummaryAsync(int currentUserId, bool isAdmin)
    {
        var accessibleUnitIds = await GetAccessibleUnitIdsAsync(currentUserId, isAdmin);
        if (accessibleUnitIds.Count == 0)
        {
            return new ManagementFinanceSummaryDto();
        }

        var charges = await _context.UnitCharges
            .Include(uc => uc.Payments)
            .AsNoTracking()
            .Where(uc => accessibleUnitIds.Contains(uc.UnitId) && !uc.IsCancelled)
            .ToListAsync();

        var now = DateTime.UtcNow;

        decimal totalCharged = 0;
        decimal totalPaid = 0;
        decimal overdueAmount = 0;
        HashSet<int> overdueUnitIds = new();

        foreach (var charge in charges)
        {
            totalCharged += charge.Amount;

            var paid = charge.Payments
                .Where(p => !p.IsCancelled)
                .Sum(p => p.Amount);

            totalPaid += paid;

            var remaining = charge.Amount - paid;
            if (remaining > 0 && charge.DueDate < now)
            {
                overdueAmount += remaining;
                overdueUnitIds.Add(charge.UnitId);
            }
        }

        var totalOutstanding = totalCharged - totalPaid;
        if (totalOutstanding < 0) totalOutstanding = 0;

        var pendingSubmissionCount = await _context.PaymentSubmissions
            .AsNoTracking()
            .Where(ps => ps.Status == "PENDING" && accessibleUnitIds.Contains(ps.UnitCharge.UnitId))
            .CountAsync();

        return new ManagementFinanceSummaryDto
        {
            TotalCharged = totalCharged,
            TotalPaid = totalPaid,
            TotalOutstanding = totalOutstanding,
            OverdueAmount = overdueAmount,
            PendingSubmissionCount = pendingSubmissionCount,
            TotalUnitsCount = accessibleUnitIds.Count,
            OverdueUnitCount = overdueUnitIds.Count
        };
    }

    public async Task<List<MonthlyCollectionSummaryDto>> GetManagementMonthlyCollectionsAsync(int currentUserId, bool isAdmin)
    {
        var accessibleUnitIds = await GetAccessibleUnitIdsAsync(currentUserId, isAdmin);
        if (accessibleUnitIds.Count == 0)
        {
            return new List<MonthlyCollectionSummaryDto>();
        }

        var now = DateTime.UtcNow;
        var startDate = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-11);

        // Fetch non-cancelled charges in scope due from startDate onwards
        var charges = await _context.UnitCharges
            .AsNoTracking()
            .Where(uc => accessibleUnitIds.Contains(uc.UnitId) && !uc.IsCancelled && uc.DueDate >= startDate)
            .Select(uc => new { uc.DueDate, uc.Amount })
            .ToListAsync();

        // Fetch valid payments in scope received from startDate onwards
        var payments = await _context.Payments
            .AsNoTracking()
            .Where(p => !p.IsCancelled && !p.UnitCharge.IsCancelled && accessibleUnitIds.Contains(p.UnitCharge.UnitId) && p.PaymentDate >= startDate)
            .Select(p => new { p.PaymentDate, p.Amount })
            .ToListAsync();

        var result = new List<MonthlyCollectionSummaryDto>();

        decimal cumulativeCharged = 0;
        decimal cumulativeCollected = 0;

        for (int i = 0; i < 12; i++)
        {
            var targetMonth = startDate.AddMonths(i);
            var year = targetMonth.Year;
            var month = targetMonth.Month;

            var monthName = targetMonth.ToString("MMMM yyyy", TurkishCulture);

            var monthCharged = charges
                .Where(c => c.DueDate.Year == year && c.DueDate.Month == month)
                .Sum(c => c.Amount);

            var monthCollected = payments
                .Where(p => p.PaymentDate.Year == year && p.PaymentDate.Month == month)
                .Sum(p => p.Amount);

            cumulativeCharged += monthCharged;
            cumulativeCollected += monthCollected;

            var outstanding = monthCharged - monthCollected;
            var percentage = monthCharged > 0
                ? Math.Round((monthCollected * 100m) / monthCharged, 2)
                : 0.00m;

            var cumulativePercentage = cumulativeCharged > 0
                ? Math.Round((cumulativeCollected * 100m) / cumulativeCharged, 2)
                : 0.00m;

            result.Add(new MonthlyCollectionSummaryDto
            {
                Year = year,
                Month = month,
                PeriodName = monthName,
                TotalCharged = monthCharged,
                TotalCollected = monthCollected,
                OutstandingBalance = outstanding,
                CollectionPercentage = percentage,
                CumulativeCollectionPercentage = cumulativePercentage
            });
        }

        return result;
    }

    public async Task<List<UnitOutstandingReportDto>> GetHighestOutstandingUnitsAsync(int currentUserId, bool isAdmin, int count = 10)
    {
        var accessibleUnitIds = await GetAccessibleUnitIdsAsync(currentUserId, isAdmin);
        if (accessibleUnitIds.Count == 0)
        {
            return new List<UnitOutstandingReportDto>();
        }

        var charges = await _context.UnitCharges
            .Include(uc => uc.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(uc => uc.Payments)
            .AsNoTracking()
            .Where(uc => accessibleUnitIds.Contains(uc.UnitId) && !uc.IsCancelled)
            .ToListAsync();

        var now = DateTime.UtcNow;

        var reports = charges
            .GroupBy(uc => uc.Unit)
            .Select(g =>
            {
                var unit = g.Key;
                decimal totalCharged = 0;
                decimal totalPaid = 0;
                int overdueCount = 0;

                foreach (var charge in g)
                {
                    totalCharged += charge.Amount;
                    var paid = charge.Payments.Where(p => !p.IsCancelled).Sum(p => p.Amount);
                    totalPaid += paid;
                    var remaining = charge.Amount - paid;
                    if (remaining > 0 && charge.DueDate < now)
                    {
                        overdueCount++;
                    }
                }

                var remainingBalance = totalCharged - totalPaid;
                return new UnitOutstandingReportDto
                {
                    UnitId = unit.Id,
                    UnitNumber = unit.UnitNumber,
                    BuildingName = unit.Building.Name,
                    PropertyName = unit.Building.Property.Name,
                    TotalCharged = totalCharged,
                    TotalPaid = totalPaid,
                    RemainingBalance = remainingBalance,
                    OverdueChargeCount = overdueCount
                };
            })
            .Where(r => r.RemainingBalance > 0)
            .OrderByDescending(r => r.RemainingBalance)
            .ThenBy(r => r.UnitId)
            .Take(count)
            .ToList();

        return reports;
    }

    public async Task<ResidentFinanceSummaryDto> GetResidentSummaryAsync(int residentUserId)
    {
        var now = DateTime.UtcNow;

        var activeOccupancyUnitIds = await _context.UnitOccupancies
            .AsNoTracking()
            .Where(uo => uo.UserId == residentUserId && uo.IsActive && (uo.EndDate == null || uo.EndDate > now))
            .Select(uo => uo.UnitId)
            .Distinct()
            .ToListAsync();

        if (activeOccupancyUnitIds.Count == 0)
        {
            return new ResidentFinanceSummaryDto();
        }

        var charges = await _context.UnitCharges
            .Include(uc => uc.Payments)
            .AsNoTracking()
            .Where(uc => activeOccupancyUnitIds.Contains(uc.UnitId) && !uc.IsCancelled)
            .ToListAsync();

        decimal totalCharged = 0;
        decimal totalPaid = 0;
        int overdueChargeCount = 0;

        foreach (var charge in charges)
        {
            totalCharged += charge.Amount;

            var paid = charge.Payments
                .Where(p => !p.IsCancelled)
                .Sum(p => p.Amount);

            totalPaid += paid;

            var remaining = charge.Amount - paid;
            if (remaining > 0 && charge.DueDate < now)
            {
                overdueChargeCount++;
            }
        }

        var totalOutstanding = totalCharged - totalPaid;
        if (totalOutstanding < 0) totalOutstanding = 0;

        var pendingSubmissionCount = await _context.PaymentSubmissions
            .AsNoTracking()
            .Where(ps => ps.SubmittedByUserId == residentUserId && ps.Status == "PENDING")
            .CountAsync();

        return new ResidentFinanceSummaryDto
        {
            TotalCharged = totalCharged,
            TotalPaid = totalPaid,
            TotalOutstanding = totalOutstanding,
            OverdueChargeCount = overdueChargeCount,
            PendingSubmissionCount = pendingSubmissionCount,
            ActiveOccupancyUnitCount = activeOccupancyUnitIds.Count
        };
    }

    private async Task<List<int>> GetAccessibleUnitIdsAsync(int userId, bool isAdmin)
    {
        if (isAdmin)
        {
            return await _context.Units
                .AsNoTracking()
                .Where(u => u.IsActive && u.Building.IsActive && u.Building.Property.IsActive)
                .Select(u => u.Id)
                .ToListAsync();
        }

        var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(userId, isAdmin);
        var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(userId, isAdmin);

        return await _context.Units
            .AsNoTracking()
            .Where(u => u.IsActive && u.Building.IsActive && u.Building.Property.IsActive &&
                        (accessibleBuildingIds.Contains(u.BuildingId) || accessiblePropertyIds.Contains(u.Building.PropertyId)))
            .Select(u => u.Id)
            .ToListAsync();
    }
}
