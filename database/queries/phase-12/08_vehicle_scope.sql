-- ============================================================================
-- Phase 12 Verification Query 08: Vehicle Scope Isolation & Building Filtering
-- ============================================================================

-- 1. List vehicles accessible to Building Managers for BuildingId = 1
SELECT 
    rv.Id AS VehicleId,
    rv.PlateNumber,
    rv.VehicleType,
    rv.IsActive,
    u.UnitNumber,
    b.Id AS BuildingId,
    b.Name AS BuildingName
FROM ResidentVehicles rv
INNER JOIN Units u ON rv.UnitId = u.Id
INNER JOIN Buildings b ON u.BuildingId = b.Id
WHERE b.Id IN (
    SELECT DISTINCT ma.BuildingId 
    FROM ManagerAssignments ma 
    WHERE ma.IsActive = 1 AND ma.BuildingId IS NOT NULL
);

-- 2. Vehicle count by type and property
SELECT 
    p.Name AS PropertyName,
    rv.VehicleType,
    COUNT(*) AS VehicleCount
FROM ResidentVehicles rv
INNER JOIN Units u ON rv.UnitId = u.Id
INNER JOIN Buildings b ON u.BuildingId = b.Id
INNER JOIN Properties p ON b.PropertyId = p.Id
WHERE rv.IsActive = 1
GROUP BY p.Name, rv.VehicleType;
