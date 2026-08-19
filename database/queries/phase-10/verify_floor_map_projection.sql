-- ============================================================================
-- Phase 10: Building Floor Map Projection Verification Queries
-- ============================================================================

-- 1. Building Floor Summary & Unit Grouping by FloorNumber
SELECT 
    b.Id AS BuildingId,
    b.Name AS BuildingName,
    b.Code AS BuildingCode,
    u.FloorNumber,
    CASE 
        WHEN u.FloorNumber = 0 THEN 'Zemin Kat'
        ELSE CAST(u.FloorNumber AS VARCHAR(10)) + '. Kat'
    END AS FloorLabel,
    COUNT(u.Id) AS TotalUnitsOnFloor,
    STRING_AGG(u.UnitNumber, ', ') WITHIN GROUP (ORDER BY u.UnitNumber) AS UnitNumbers
FROM Buildings b
JOIN Units u ON u.BuildingId = b.Id
WHERE b.Id = 1 AND u.IsActive = 1
GROUP BY b.Id, b.Name, b.Code, u.FloorNumber
ORDER BY u.FloorNumber DESC;


-- 2. Active Occupancy Summary per Unit
SELECT 
    u.Id AS UnitId,
    u.UnitNumber,
    u.FloorNumber,
    COUNT(uo.Id) AS ActiveResidentCount,
    MAX(CASE WHEN uo.IsPrimary = 1 THEN usr.FirstName + ' ' + usr.LastName END) AS PrimaryResidentName,
    CASE 
        WHEN COUNT(uo.Id) = 0 THEN 'VACANT'
        WHEN SUM(CASE WHEN ot.Code = 'TENANT' THEN 1 ELSE 0 END) > 0 THEN 'OCCUPIED_TENANT'
        ELSE 'OCCUPIED_OWNER'
    END AS OccupancyStatus
FROM Units u
LEFT JOIN UnitOccupancies uo ON uo.UnitId = u.Id 
    AND uo.IsActive = 1 
    AND (uo.EndDate IS NULL OR uo.EndDate > GETUTCDATE())
LEFT JOIN Users usr ON usr.Id = uo.UserId
LEFT JOIN OccupancyTypes ot ON ot.Id = uo.OccupancyTypeId
WHERE u.BuildingId = 1
GROUP BY u.Id, u.UnitNumber, u.FloorNumber
ORDER BY u.FloorNumber DESC, u.UnitNumber ASC;


-- 3. Outstanding & Overdue Finance Summary per Unit
SELECT 
    u.Id AS UnitId,
    u.UnitNumber,
    u.FloorNumber,
    ISNULL(SUM(uc.Amount), 0) AS TotalCharged,
    ISNULL(SUM(p.Amount), 0) AS TotalPaid,
    ISNULL(SUM(uc.Amount), 0) - ISNULL(SUM(p.Amount), 0) AS OutstandingBalance,
    CASE 
        WHEN SUM(CASE WHEN (uc.Amount - ISNULL(p.Amount, 0)) > 0 AND uc.DueDate < GETUTCDATE() THEN 1 ELSE 0 END) > 0 
        THEN 1 ELSE 0 
    END AS HasOverdueDebt
FROM Units u
LEFT JOIN UnitCharges uc ON uc.UnitId = u.Id AND uc.IsCancelled = 0
LEFT JOIN (
    SELECT UnitChargeId, SUM(Amount) AS Amount 
    FROM Payments 
    WHERE IsCancelled = 0 
    GROUP BY UnitChargeId
) p ON p.UnitChargeId = uc.Id
WHERE u.BuildingId = 1
GROUP BY u.Id, u.UnitNumber, u.FloorNumber
ORDER BY u.FloorNumber DESC, u.UnitNumber ASC;


-- 4. Active Maintenance Requests & Priority Summary per Unit
SELECT 
    u.Id AS UnitId,
    u.UnitNumber,
    u.FloorNumber,
    COUNT(mr.Id) AS OpenMaintenanceRequestCount,
    SUM(CASE WHEN mr.Priority = 'EMERGENCY' THEN 1 ELSE 0 END) AS EmergencyRequestCount,
    CASE 
        WHEN SUM(CASE WHEN mr.Priority = 'EMERGENCY' THEN 1 ELSE 0 END) > 0 THEN 1 
        ELSE 0 
    END AS HasEmergencyMaintenanceRequest,
    CASE 
        WHEN COUNT(mr.Id) = 0 THEN 'NONE'
        WHEN SUM(CASE WHEN mr.Priority = 'EMERGENCY' THEN 1 ELSE 0 END) > 0 THEN 'EMERGENCY'
        WHEN SUM(CASE WHEN mr.Priority = 'HIGH' THEN 1 ELSE 0 END) > 0 THEN 'HIGH'
        WHEN SUM(CASE WHEN mr.Priority = 'NORMAL' THEN 1 ELSE 0 END) > 0 THEN 'NORMAL'
        WHEN SUM(CASE WHEN mr.Priority = 'LOW' THEN 1 ELSE 0 END) > 0 THEN 'LOW'
        ELSE 'NORMAL'
    END AS HighestMaintenancePriority
FROM Units u
LEFT JOIN MaintenanceRequests mr ON mr.UnitId = u.Id 
    AND (mr.Status = 'OPEN' OR mr.Status = 'IN_PROGRESS')
WHERE u.BuildingId = 1
GROUP BY u.Id, u.UnitNumber, u.FloorNumber
ORDER BY u.FloorNumber DESC, u.UnitNumber ASC;
