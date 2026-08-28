-- ============================================================================
-- Phase 12 Verification Query 07: Resident Vehicles & Duplicate Plate Audit
-- ============================================================================

-- 1. All registered resident vehicles with resident & unit details
SELECT 
    rv.Id AS VehicleId,
    rv.PlateNumber,
    rv.VehicleType,
    rv.BrandModel,
    rv.Color,
    rv.IsActive,
    u.UnitNumber,
    b.Name AS BuildingName,
    CONCAT(res.FirstName, ' ', res.LastName) AS ResidentName
FROM ResidentVehicles rv
INNER JOIN Units u ON rv.UnitId = u.Id
INNER JOIN Buildings b ON u.BuildingId = b.Id
INNER JOIN Users res ON rv.ResidentUserId = res.Id
ORDER BY rv.IsActive DESC, rv.CreatedAt DESC;

-- 2. Verify active vehicle plate uniqueness constraint
SELECT 
    PlateNumber, 
    COUNT(*) AS ActiveCount
FROM ResidentVehicles
WHERE IsActive = 1
GROUP BY PlateNumber
HAVING COUNT(*) > 1;
