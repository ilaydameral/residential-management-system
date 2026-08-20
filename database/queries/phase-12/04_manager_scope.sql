-- Phase 12 Verification Script 04: Manager Scope & Facility Isolation Check
-- Verify which manager user accounts can access building vs property facilities

SELECT 
    u.Id AS ManagerUserId,
    u.FirstName + ' ' + u.LastName AS ManagerName,
    ma.PropertyId,
    p.Name AS PropertyName,
    ma.BuildingId,
    b.Name AS BuildingName,
    f.Id AS AccessibleFacilityId,
    f.Name AS AccessibleFacilityName,
    f.BuildingId AS FacilityBuildingId
FROM ManagerAssignments ma
INNER JOIN Users u ON ma.ManagerUserId = u.Id
INNER JOIN Properties p ON ma.PropertyId = p.Id
LEFT JOIN Buildings b ON ma.BuildingId = b.Id
INNER JOIN CommonFacilities f ON f.PropertyId = ma.PropertyId
WHERE ma.IsActive = 1
  AND (ma.BuildingId IS NULL OR f.BuildingId = ma.BuildingId)
ORDER BY u.Id, f.Id;
