-- ==============================================================================
-- Document: Phase 8 Financial Reporting & Analytical Queries Reference
-- Note: Operational and analytical read-only queries for Unit balances,
-- Dues Period collection rates, Overdue charges, and Expense breakdowns.
-- Safe to execute even when financial tables are empty.
-- ==============================================================================

USE ApartmentManagementDb;
GO

PRINT '=============================================================================';
PRINT '1. Unit Balance Summary (Total Charged, Total Paid, Remaining Balance)';
PRINT '=============================================================================';

WITH UnitPayments AS (
    SELECT 
        p.UnitChargeId,
        SUM(p.Amount) AS TotalPaidAmount
    FROM dbo.Payments p
    WHERE p.IsCancelled = 0
    GROUP BY p.UnitChargeId
),
UnitChargeBalances AS (
    SELECT 
        uc.Id AS UnitChargeId,
        uc.UnitId,
        uc.Title,
        uc.Amount AS ChargedAmount,
        ISNULL(up.TotalPaidAmount, 0) AS PaidAmount,
        (uc.Amount - ISNULL(up.TotalPaidAmount, 0)) AS RemainingAmount,
        uc.DueDate,
        uc.ChargeType,
        CASE 
            WHEN uc.IsCancelled = 1 THEN 'CANCELLED'
            WHEN ISNULL(up.TotalPaidAmount, 0) >= uc.Amount THEN 'PAID'
            WHEN ISNULL(up.TotalPaidAmount, 0) > 0 THEN 'PARTIALLY_PAID'
            WHEN uc.DueDate < GETUTCDATE() THEN 'OVERDUE'
            ELSE 'UNPAID'
        END AS CalculatedStatus
    FROM dbo.UnitCharges uc
    LEFT JOIN UnitPayments up ON uc.Id = up.UnitChargeId
    WHERE uc.IsCancelled = 0
)
SELECT 
    p.Name AS PropertyName,
    b.Name AS BuildingName,
    u.Id AS UnitId,
    u.UnitNumber,
    SUM(ucb.ChargedAmount) AS TotalChargedAmount,
    SUM(ucb.PaidAmount) AS TotalPaidAmount,
    SUM(ucb.RemainingAmount) AS TotalRemainingBalance,
    COUNT(CASE WHEN ucb.CalculatedStatus = 'OVERDUE' THEN 1 END) AS OverdueChargeCount
FROM dbo.Units u
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
LEFT JOIN UnitChargeBalances ucb ON u.Id = ucb.UnitId
GROUP BY p.Name, b.Name, u.Id, u.UnitNumber
ORDER BY p.Name, b.Name, u.UnitNumber;
GO

PRINT '=============================================================================';
PRINT '2. Dues Period Collection Summary (Expected vs Collected Rates)';
PRINT '=============================================================================';

WITH PeriodChargeSummary AS (
    SELECT 
        uc.DuePeriodId,
        COUNT(uc.Id) AS TotalUnitsCharged,
        SUM(uc.Amount) AS TotalExpectedAmount,
        SUM(ISNULL(p.Amount, 0)) AS TotalCollectedAmount
    FROM dbo.UnitCharges uc
    LEFT JOIN dbo.Payments p ON uc.Id = p.UnitChargeId AND p.IsCancelled = 0
    WHERE uc.IsCancelled = 0 AND uc.DuePeriodId IS NOT NULL
    GROUP BY uc.DuePeriodId
)
SELECT 
    dp.Id AS PeriodId,
    dd.Title AS DuesDefinitionTitle,
    dp.Year,
    dp.Month,
    dp.PeriodName,
    dp.Status AS PeriodStatus,
    ISNULL(pcs.TotalUnitsCharged, 0) AS TotalUnitsCharged,
    ISNULL(pcs.TotalExpectedAmount, 0.00) AS TotalExpectedAmount,
    ISNULL(pcs.TotalCollectedAmount, 0.00) AS TotalCollectedAmount,
    (ISNULL(pcs.TotalExpectedAmount, 0.00) - ISNULL(pcs.TotalCollectedAmount, 0.00)) AS OutstandingBalance,
    CASE 
        WHEN ISNULL(pcs.TotalExpectedAmount, 0) > 0 
        THEN CAST((ISNULL(pcs.TotalCollectedAmount, 0) * 100.0 / pcs.TotalExpectedAmount) AS DECIMAL(5,2))
        ELSE 0.00 
    END AS CollectionPercentage
FROM dbo.DuePeriods dp
INNER JOIN dbo.DueDefinitions dd ON dp.DueDefinitionId = dd.Id
LEFT JOIN PeriodChargeSummary pcs ON dp.Id = pcs.DuePeriodId
WHERE dp.Status <> 'CANCELLED'
ORDER BY dp.Year DESC, dp.Month DESC;
GO

PRINT '=============================================================================';
PRINT '3. Overdue Charges Detail Report';
PRINT '=============================================================================';

WITH ActivePayments AS (
    SELECT 
        UnitChargeId,
        SUM(Amount) AS TotalPaid
    FROM dbo.Payments
    WHERE IsCancelled = 0
    GROUP BY UnitChargeId
)
SELECT 
    uc.Id AS UnitChargeId,
    p.Name AS PropertyName,
    b.Name AS BuildingName,
    u.UnitNumber,
    uc.Title AS ChargeTitle,
    uc.Amount AS OriginalAmount,
    ISNULL(ap.TotalPaid, 0) AS PaidAmount,
    (uc.Amount - ISNULL(ap.TotalPaid, 0)) AS OverdueBalance,
    uc.DueDate,
    DATEDIFF(DAY, uc.DueDate, GETUTCDATE()) AS DaysOverdue
FROM dbo.UnitCharges uc
INNER JOIN dbo.Units u ON uc.UnitId = u.Id
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
LEFT JOIN ActivePayments ap ON uc.Id = ap.UnitChargeId
WHERE uc.IsCancelled = 0
  AND (uc.Amount - ISNULL(ap.TotalPaid, 0)) > 0
  AND uc.DueDate < GETUTCDATE()
ORDER BY DaysOverdue DESC, p.Name, u.UnitNumber;
GO

PRINT '=============================================================================';
PRINT '4. Expenses Breakdown by Category';
PRINT '=============================================================================';

SELECT 
    p.Name AS PropertyName,
    ISNULL(b.Name, 'Site Geneli (Tüm Bloklar)') AS ScopeName,
    e.Category,
    COUNT(e.Id) AS ExpenseCount,
    SUM(e.Amount) AS TotalCategoryExpense
FROM dbo.Expenses e
INNER JOIN dbo.Properties p ON e.PropertyId = p.Id
LEFT JOIN dbo.Buildings b ON e.BuildingId = b.Id
WHERE e.IsCancelled = 0
GROUP BY p.Name, ISNULL(b.Name, 'Site Geneli (Tüm Bloklar)'), e.Category
ORDER BY p.Name, ScopeName, TotalCategoryExpense DESC;
GO
