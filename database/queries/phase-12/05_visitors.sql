-- ============================================================================
-- Phase 12 Verification Query 05: Active & Upcoming Visitors Lifecycle
-- ============================================================================

-- 1. List active/upcoming visitors with host resident details
SELECT 
    v.Id AS VisitorId,
    v.VisitorName,
    v.VisitorPhone,
    v.VisitorType,
    v.VehiclePlate,
    v.AccessCode,
    v.Status,
    v.ExpectedArrival,
    v.ExpectedDeparture,
    v.CheckedInAt,
    v.CheckedOutAt,
    u.UnitNumber,
    b.Name AS BuildingName,
    p.Name AS PropertyName,
    CONCAT(host.FirstName, ' ', host.LastName) AS HostResidentName
FROM Visitors v
INNER JOIN Units u ON v.UnitId = u.Id
INNER JOIN Buildings b ON u.BuildingId = b.Id
INNER JOIN Properties p ON b.PropertyId = p.Id
INNER JOIN Users host ON v.HostUserId = host.Id
ORDER BY v.ExpectedArrival DESC;

-- 2. Count visitors grouped by status
SELECT 
    Status, 
    COUNT(*) AS VisitorCount
FROM Visitors
GROUP BY Status;
