-- ============================================================================
-- Phase 12 Verification Query 06: Visitor Manager Scope Isolation
-- ============================================================================

-- 1. Visitors visible to Building Managers for BuildingId = 1
SELECT 
    v.Id AS VisitorId,
    v.VisitorName,
    v.Status,
    u.UnitNumber,
    b.Id AS BuildingId,
    b.Name AS BuildingName
FROM Visitors v
INNER JOIN Units u ON v.UnitId = u.Id
INNER JOIN Buildings b ON u.BuildingId = b.Id
WHERE b.Id IN (
    SELECT DISTINCT ma.BuildingId 
    FROM ManagerAssignments ma 
    WHERE ma.IsActive = 1 AND ma.BuildingId IS NOT NULL
);

-- 2. Check-in history audit log
SELECT 
    v.Id AS VisitorId,
    v.VisitorName,
    v.CheckedInAt,
    v.CheckedOutAt,
    CONCAT(checker.FirstName, ' ', checker.LastName) AS CheckedInByStaff
FROM Visitors v
LEFT JOIN Users checker ON v.CheckedInByUserId = checker.Id
WHERE v.Status IN ('CHECKED_IN', 'CHECKED_OUT');
