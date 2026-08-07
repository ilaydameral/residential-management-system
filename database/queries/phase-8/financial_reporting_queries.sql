-- ==============================================================================
-- Document: Phase 8 Financial Reporting & Analytical Queries Reference
-- Note: Operational and analytical read-only queries for Unit balances,
-- Monthly collection rates, Overdue charges, and Expense breakdowns.
-- Safe to execute even when financial tables are empty.
-- ==============================================================================

USE ApartmentManagementDb;
GO

PRINT '=============================================================================';
PRINT '1. Management Financial Summary (Total Charged, Paid, Outstanding, Overdue)';
PRINT '=============================================================================';

WITH ValidPayments AS (
    SELECT
        p.UnitChargeId,
        SUM(p.Amount) AS TotalPaidAmount
    FROM dbo.Payments p
    WHERE p.IsCancelled = 0
    GROUP BY p.UnitChargeId
),
ChargeSummary AS (
    SELECT
        uc.Id AS UnitChargeId,
        uc.UnitId,
        uc.Amount AS ChargedAmount,
        ISNULL(vp.TotalPaidAmount, 0) AS PaidAmount,
        (uc.Amount - ISNULL(vp.TotalPaidAmount, 0)) AS RemainingAmount,
        uc.DueDate,
        CASE
            WHEN uc.IsCancelled = 1 THEN 'CANCELLED'
            WHEN ISNULL(vp.TotalPaidAmount, 0) >= uc.Amount THEN 'PAID'
            WHEN ISNULL(vp.TotalPaidAmount, 0) > 0 THEN 'PARTIALLY_PAID'
            WHEN uc.DueDate < GETUTCDATE() THEN 'OVERDUE'
            ELSE 'UNPAID'
        END AS CalculatedStatus
    FROM dbo.UnitCharges uc
    LEFT JOIN ValidPayments vp ON uc.Id = vp.UnitChargeId
    WHERE uc.IsCancelled = 0
),
PendingSubmissions AS (
    SELECT COUNT(*) AS PendingCount
    FROM dbo.PaymentSubmissions
    WHERE Status = 'PENDING'
)
SELECT
    ISNULL(SUM(cs.ChargedAmount), 0.00) AS TotalCharged,
    ISNULL(SUM(cs.PaidAmount), 0.00) AS TotalPaid,
    ISNULL(SUM(cs.RemainingAmount), 0.00) AS TotalOutstanding,
    ISNULL(SUM(CASE WHEN cs.DueDate < GETUTCDATE() AND cs.RemainingAmount > 0 THEN cs.RemainingAmount ELSE 0 END), 0.00) AS OverdueAmount,
    (SELECT PendingCount FROM PendingSubmissions) AS PendingSubmissionCount,
    COUNT(DISTINCT u.Id) AS TotalActiveUnitsCount,
    COUNT(DISTINCT CASE WHEN cs.DueDate < GETUTCDATE() AND cs.RemainingAmount > 0 THEN u.Id END) AS OverdueUnitsCount
FROM dbo.Units u
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id AND b.IsActive = 1
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id AND p.IsActive = 1
LEFT JOIN ChargeSummary cs ON u.Id = cs.UnitId
WHERE u.IsActive = 1;
GO

PRINT '=============================================================================';
PRINT '2. Monthly Collection Summary (12-Month Series with DueDate & PaymentDate)';
PRINT '=============================================================================';

WITH MonthSeries AS (
    -- Generates last 12 calendar months ending in current UTC month
    SELECT
        YEAR(DATEADD(MONTH, -n, GETUTCDATE())) AS [Year],
        MONTH(DATEADD(MONTH, -n, GETUTCDATE())) AS [Month]
    FROM (VALUES (11),(10),(9),(8),(7),(6),(5),(4),(3),(2),(1),(0)) AS Months(n)
),
MonthlyCharges AS (
    SELECT
        YEAR(uc.DueDate) AS [Year],
        MONTH(uc.DueDate) AS [Month],
        SUM(uc.Amount) AS TotalCharged
    FROM dbo.UnitCharges uc
    WHERE uc.IsCancelled = 0
    GROUP BY YEAR(uc.DueDate), MONTH(uc.DueDate)
),
MonthlyPayments AS (
    SELECT
        YEAR(p.PaymentDate) AS [Year],
        MONTH(p.PaymentDate) AS [Month],
        SUM(p.Amount) AS TotalCollected
    FROM dbo.Payments p
    INNER JOIN dbo.UnitCharges uc ON p.UnitChargeId = uc.Id
    WHERE p.IsCancelled = 0 AND uc.IsCancelled = 0
    GROUP BY YEAR(p.PaymentDate), MONTH(p.PaymentDate)
),
MonthlyCombined AS (
    SELECT
        ms.[Year],
        ms.[Month],
        ISNULL(mc.TotalCharged, 0.00) AS TotalCharged,
        ISNULL(mp.TotalCollected, 0.00) AS TotalCollected,
        (ISNULL(mc.TotalCharged, 0.00) - ISNULL(mp.TotalCollected, 0.00)) AS OutstandingBalance,
        CASE
            WHEN ISNULL(mc.TotalCharged, 0) > 0
            THEN CAST((ISNULL(mp.TotalCollected, 0) * 100.0 / mc.TotalCharged) AS DECIMAL(5,2))
            ELSE 0.00
        END AS CollectionPercentage
    FROM MonthSeries ms
    LEFT JOIN MonthlyCharges mc ON ms.[Year] = mc.[Year] AND ms.[Month] = mc.[Month]
    LEFT JOIN MonthlyPayments mp ON ms.[Year] = mp.[Year] AND ms.[Month] = mp.[Month]
)
SELECT
    c.[Year],
    c.[Month],
    c.TotalCharged,
    c.TotalCollected,
    c.OutstandingBalance,
    c.CollectionPercentage,
    SUM(c.TotalCharged) OVER (ORDER BY c.[Year], c.[Month]) AS CumulativeCharged,
    SUM(c.TotalCollected) OVER (ORDER BY c.[Year], c.[Month]) AS CumulativeCollected,
    CASE
        WHEN SUM(c.TotalCharged) OVER (ORDER BY c.[Year], c.[Month]) > 0
        THEN CAST((SUM(c.TotalCollected) OVER (ORDER BY c.[Year], c.[Month]) * 100.0 / SUM(c.TotalCharged) OVER (ORDER BY c.[Year], c.[Month])) AS DECIMAL(5,2))
        ELSE 0.00
    END AS CumulativeCollectionPercentage
FROM MonthlyCombined c
ORDER BY c.[Year] ASC, c.[Month] ASC;
GO

PRINT '=============================================================================';
PRINT '3. Highest Outstanding Units (Top Units with Remaining Balance > 0)';
PRINT '=============================================================================';

WITH ActivePayments AS (
    SELECT
        UnitChargeId,
        SUM(Amount) AS TotalPaid
    FROM dbo.Payments
    WHERE IsCancelled = 0
    GROUP BY UnitChargeId
),
UnitBalances AS (
    SELECT
        u.Id AS UnitId,
        u.UnitNumber,
        b.Name AS BuildingName,
        p.Name AS PropertyName,
        ISNULL(SUM(uc.Amount), 0.00) AS TotalCharged,
        ISNULL(SUM(ap.TotalPaid), 0.00) AS TotalPaid,
        (ISNULL(SUM(uc.Amount), 0.00) - ISNULL(SUM(ap.TotalPaid), 0.00)) AS RemainingBalance,
        COUNT(CASE WHEN uc.DueDate < GETUTCDATE() AND (uc.Amount - ISNULL(ap.TotalPaid, 0)) > 0 THEN 1 END) AS OverdueChargeCount
    FROM dbo.Units u
    INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
    INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
    LEFT JOIN dbo.UnitCharges uc ON u.Id = uc.UnitId AND uc.IsCancelled = 0
    LEFT JOIN ActivePayments ap ON uc.Id = ap.UnitChargeId
    GROUP BY u.Id, u.UnitNumber, b.Name, p.Name
)
SELECT TOP 10
    UnitId,
    UnitNumber,
    BuildingName,
    PropertyName,
    TotalCharged,
    TotalPaid,
    RemainingBalance,
    OverdueChargeCount
FROM UnitBalances
WHERE RemainingBalance > 0
ORDER BY RemainingBalance DESC, UnitId ASC;
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

PRINT '=============================================================================';
PRINT '5. Due Period Collection Details Query (Per-Unit Breakdown & Aggregates)';
PRINT '=============================================================================';

DECLARE @TargetDuePeriodId INT = 1; -- Replace with target DuePeriodId

WITH ValidPayments AS (
    SELECT
        p.UnitChargeId,
        SUM(p.Amount) AS TotalPaid
    FROM dbo.Payments p
    WHERE p.IsCancelled = 0
    GROUP BY p.UnitChargeId
),
PendingSubmissions AS (
    SELECT
        ps.UnitChargeId,
        SUM(ps.Amount) AS PendingAmount,
        COUNT(ps.Id) AS PendingCount
    FROM dbo.PaymentSubmissions ps
    WHERE ps.Status = 'PENDING'
    GROUP BY ps.UnitChargeId
),
ChargeDetails AS (
    SELECT
        uc.Id AS UnitChargeId,
        uc.UnitId,
        u.UnitNumber,
        b.Name AS BuildingName,
        p.Name AS PropertyName,
        uc.Amount AS AssessedAmount,
        ISNULL(vp.TotalPaid, 0.00) AS PaidAmount,
        CASE
            WHEN (uc.Amount - ISNULL(vp.TotalPaid, 0.00)) < 0 THEN 0.00
            ELSE (uc.Amount - ISNULL(vp.TotalPaid, 0.00))
        END AS RemainingAmount,
        ISNULL(ps.PendingAmount, 0.00) AS PendingSubmissionAmount,
        CASE WHEN ISNULL(ps.PendingCount, 0) > 0 THEN 1 ELSE 0 END AS HasPendingSubmission,
        uc.DueDate,
        CASE
            WHEN uc.IsCancelled = 1 THEN 'CANCELLED'
            WHEN (uc.Amount - ISNULL(vp.TotalPaid, 0.00)) <= 0 THEN 'PAID'
            WHEN ISNULL(vp.TotalPaid, 0.00) > 0 THEN 'PARTIALLY_PAID'
            WHEN uc.DueDate < GETUTCDATE() THEN 'OVERDUE'
            ELSE 'UNPAID'
        END AS CalculatedStatus
    FROM dbo.UnitCharges uc
    INNER JOIN dbo.Units u ON uc.UnitId = u.Id
    INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
    INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
    LEFT JOIN ValidPayments vp ON uc.Id = vp.UnitChargeId
    LEFT JOIN PendingSubmissions ps ON uc.Id = ps.UnitChargeId
    WHERE uc.DuePeriodId = @TargetDuePeriodId AND uc.IsCancelled = 0
)
SELECT
    COUNT(*) AS TotalUnitCount,
    SUM(AssessedAmount) AS TotalAssessedAmount,
    SUM(PaidAmount) AS TotalCollectedAmount,
    SUM(RemainingAmount) AS TotalOutstandingAmount,
    SUM(CASE WHEN CalculatedStatus = 'PAID' THEN 1 ELSE 0 END) AS PaidUnitCount,
    SUM(CASE WHEN CalculatedStatus = 'PARTIALLY_PAID' THEN 1 ELSE 0 END) AS PartiallyPaidUnitCount,
    SUM(CASE WHEN CalculatedStatus = 'UNPAID' THEN 1 ELSE 0 END) AS UnpaidUnitCount,
    SUM(CASE WHEN CalculatedStatus = 'OVERDUE' THEN 1 ELSE 0 END) AS OverdueUnitCount,
    SUM(CASE WHEN HasPendingSubmission = 1 THEN 1 ELSE 0 END) AS PendingSubmissionUnitCount
FROM ChargeDetails;
GO
