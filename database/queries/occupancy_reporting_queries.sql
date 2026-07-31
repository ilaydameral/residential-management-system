-- ==============================================================================
-- Document: Occupancy Reporting & Analytical Queries Reference
-- Note: Operational and analytical read-only queries for unit occupancies,
-- resident history, occupancy breakdown by type, unassigned/empty units,
-- and property occupancy rates.
-- Occupancy Definition: A Unit is considered "Occupied" if it has an active
-- TENANT or HOUSEHOLD_MEMBER relationship (IsActive = 1 AND (EndDate IS NULL OR EndDate >= GETUTCDATE())).
-- Having ONLY an OWNER record does NOT constitute occupancy on its own.
-- Safe to execute even when dbo.UnitOccupancies is currently empty.
-- ==============================================================================

USE ApartmentManagementDb;
GO

-- 1. Active Occupancy Records by Unit
SELECT 
    u.Id AS UnitId,
    u.UnitNumber,
    b.Name AS BuildingName,
    p.Name AS PropertyName,
    usr.Id AS UserId,
    usr.FirstName + ' ' + usr.LastName AS OccupantName,
    usr.Email AS OccupantEmail,
    ot.Code AS OccupancyTypeCode,
    ot.Name AS OccupancyTypeName,
    uo.StartDate,
    uo.EndDate,
    uo.IsPrimary,
    uo.IsActive
FROM dbo.Units u
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
INNER JOIN dbo.UnitOccupancies uo ON u.Id = uo.UnitId
INNER JOIN dbo.Users usr ON uo.UserId = usr.Id
INNER JOIN dbo.OccupancyTypes ot ON uo.OccupancyTypeId = ot.Id
WHERE uo.IsActive = 1 AND (uo.EndDate IS NULL OR uo.EndDate >= GETUTCDATE())
ORDER BY p.Name, b.Name, u.UnitNumber;
GO

-- 2. Occupancy History by User
SELECT 
    usr.Id AS UserId,
    usr.UserName,
    usr.FirstName + ' ' + usr.LastName AS FullName,
    p.Name AS PropertyName,
    b.Name AS BuildingName,
    u.UnitNumber,
    ot.Code AS OccupancyTypeCode,
    ot.Name AS OccupancyTypeName,
    uo.StartDate,
    uo.EndDate,
    uo.IsPrimary,
    uo.IsActive,
    uo.Notes
FROM dbo.Users usr
INNER JOIN dbo.UnitOccupancies uo ON usr.Id = uo.UserId
INNER JOIN dbo.Units u ON uo.UnitId = u.Id
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
INNER JOIN dbo.OccupancyTypes ot ON uo.OccupancyTypeId = ot.Id
ORDER BY usr.Id, uo.StartDate DESC;
GO

-- 3. Active Resident List with Property and Building Details
SELECT 
    usr.Id AS UserId,
    usr.FirstName,
    usr.LastName,
    usr.Email,
    p.Name AS PropertyName,
    b.Name AS BuildingName,
    u.UnitNumber,
    ot.Name AS OccupancyRole,
    uo.IsPrimary
FROM dbo.UnitOccupancies uo
INNER JOIN dbo.Users usr ON uo.UserId = usr.Id
INNER JOIN dbo.Units u ON uo.UnitId = u.Id
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
INNER JOIN dbo.OccupancyTypes ot ON uo.OccupancyTypeId = ot.Id
WHERE uo.IsActive = 1 
  AND usr.IsActive = 1 
  AND (uo.EndDate IS NULL OR uo.EndDate >= GETUTCDATE())
ORDER BY p.Name, b.Name, u.UnitNumber;
GO

-- 4. Count of Active Occupancies by Type (OWNER / TENANT / HOUSEHOLD_MEMBER)
SELECT 
    ot.Id AS OccupancyTypeId,
    ot.Code AS OccupancyTypeCode,
    ot.Name AS OccupancyTypeName,
    COUNT(uo.Id) AS ActiveCount
FROM dbo.OccupancyTypes ot
LEFT JOIN dbo.UnitOccupancies uo ON ot.Id = uo.OccupancyTypeId 
    AND uo.IsActive = 1 
    AND (uo.EndDate IS NULL OR uo.EndDate >= GETUTCDATE())
GROUP BY ot.Id, ot.Code, ot.Name
ORDER BY ot.Id;
GO

-- 5. Units with No Active Occupancy Records (Fully Unassigned Units)
SELECT 
    u.Id AS UnitId,
    u.UnitNumber,
    b.Name AS BuildingName,
    p.Name AS PropertyName
FROM dbo.Units u
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
LEFT JOIN dbo.UnitOccupancies uo ON u.Id = uo.UnitId 
    AND uo.IsActive = 1 
    AND (uo.EndDate IS NULL OR uo.EndDate >= GETUTCDATE())
WHERE uo.Id IS NULL
ORDER BY p.Name, b.Name, u.UnitNumber;
GO

-- 6. Units with Active Owner Record but No Active Tenant / Household Member (Unoccupied Owned Units)
SELECT 
    u.Id AS UnitId,
    u.UnitNumber,
    b.Name AS BuildingName,
    p.Name AS PropertyName
FROM dbo.Units u
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
WHERE EXISTS (
    SELECT 1 FROM dbo.UnitOccupancies uoOwner
    INNER JOIN dbo.OccupancyTypes otOwner ON uoOwner.OccupancyTypeId = otOwner.Id
    WHERE uoOwner.UnitId = u.Id 
      AND otOwner.Code = 'OWNER' 
      AND uoOwner.IsActive = 1 
      AND (uoOwner.EndDate IS NULL OR uoOwner.EndDate >= GETUTCDATE())
)
AND NOT EXISTS (
    SELECT 1 FROM dbo.UnitOccupancies uoRes
    INNER JOIN dbo.OccupancyTypes otRes ON uoRes.OccupancyTypeId = otRes.Id
    WHERE uoRes.UnitId = u.Id 
      AND otRes.Code IN ('TENANT', 'HOUSEHOLD_MEMBER') 
      AND uoRes.IsActive = 1 
      AND (uoRes.EndDate IS NULL OR uoRes.EndDate >= GETUTCDATE())
)
ORDER BY p.Name, b.Name, u.UnitNumber;
GO

-- 7. Units with Multiple Active Owners (Multiple Ownership Check)
SELECT 
    u.Id AS UnitId,
    u.UnitNumber,
    b.Name AS BuildingName,
    p.Name AS PropertyName,
    COUNT(uo.Id) AS ActiveOwnerCount
FROM dbo.Units u
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
INNER JOIN dbo.UnitOccupancies uo ON u.Id = uo.UnitId
INNER JOIN dbo.OccupancyTypes ot ON uo.OccupancyTypeId = ot.Id
WHERE ot.Code = 'OWNER' 
  AND uo.IsActive = 1 
  AND (uo.EndDate IS NULL OR uo.EndDate >= GETUTCDATE())
GROUP BY u.Id, u.UnitNumber, b.Name, p.Name
HAVING COUNT(uo.Id) > 1;
GO

-- 8. Active Occupied Units Missing a Primary Contact (IsPrimary = 1 Check)
SELECT 
    u.Id AS UnitId,
    u.UnitNumber,
    b.Name AS BuildingName,
    p.Name AS PropertyName
FROM dbo.Units u
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.Properties p ON b.PropertyId = p.Id
WHERE EXISTS (
    SELECT 1 FROM dbo.UnitOccupancies uo
    WHERE uo.UnitId = u.Id 
      AND uo.IsActive = 1 
      AND (uo.EndDate IS NULL OR uo.EndDate >= GETUTCDATE())
)
AND NOT EXISTS (
    SELECT 1 FROM dbo.UnitOccupancies uoPrimary
    WHERE uoPrimary.UnitId = u.Id 
      AND uoPrimary.IsActive = 1 
      AND uoPrimary.IsPrimary = 1
      AND (uoPrimary.EndDate IS NULL OR uoPrimary.EndDate >= GETUTCDATE())
)
ORDER BY p.Name, b.Name, u.UnitNumber;
GO

-- 9. Occupancy Records Starting or Ending Within a Specified Date Range
DECLARE @RangeStart DATETIME2 = '2026-01-01T00:00:00';
DECLARE @RangeEnd DATETIME2 = '2026-12-31T23:59:59';

SELECT 
    uo.Id AS OccupancyId,
    usr.FirstName + ' ' + usr.LastName AS OccupantName,
    u.UnitNumber,
    b.Name AS BuildingName,
    ot.Code AS OccupancyType,
    uo.StartDate,
    uo.EndDate,
    uo.IsActive
FROM dbo.UnitOccupancies uo
INNER JOIN dbo.Users usr ON uo.UserId = usr.Id
INNER JOIN dbo.Units u ON uo.UnitId = u.Id
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.OccupancyTypes ot ON uo.OccupancyTypeId = ot.Id
WHERE (uo.StartDate BETWEEN @RangeStart AND @RangeEnd)
   OR (uo.EndDate BETWEEN @RangeStart AND @RangeEnd)
ORDER BY uo.StartDate DESC;
GO

-- 10. Property-Level Occupied Unit Count and Total Unit Count Summary
-- (Note: Occupied = Has active TENANT or HOUSEHOLD_MEMBER record)
SELECT 
    p.Id AS PropertyId,
    p.Name AS PropertyName,
    COUNT(DISTINCT u.Id) AS TotalUnits,
    COUNT(DISTINCT CASE 
        WHEN uo.Id IS NOT NULL 
             AND ot.Code IN ('TENANT', 'HOUSEHOLD_MEMBER') 
             AND uo.IsActive = 1 
             AND (uo.EndDate IS NULL OR uo.EndDate >= GETUTCDATE()) 
        THEN u.Id 
    END) AS OccupiedUnits,
    CAST(
        CASE 
            WHEN COUNT(DISTINCT u.Id) = 0 THEN 0.0
            ELSE (COUNT(DISTINCT CASE 
                WHEN uo.Id IS NOT NULL 
                     AND ot.Code IN ('TENANT', 'HOUSEHOLD_MEMBER') 
                     AND uo.IsActive = 1 
                     AND (uo.EndDate IS NULL OR uo.EndDate >= GETUTCDATE()) 
                THEN u.Id 
            END) * 100.0 / COUNT(DISTINCT u.Id))
        END AS DECIMAL(5,2)
    ) AS OccupancyRatePercentage
FROM dbo.Properties p
LEFT JOIN dbo.Buildings b ON p.Id = b.PropertyId
LEFT JOIN dbo.Units u ON b.Id = u.BuildingId
LEFT JOIN dbo.UnitOccupancies uo ON u.Id = uo.UnitId
LEFT JOIN dbo.OccupancyTypes ot ON uo.OccupancyTypeId = ot.Id
GROUP BY p.Id, p.Name
ORDER BY p.Id;
GO
