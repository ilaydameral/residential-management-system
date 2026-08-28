-- Phase 12 Verification Script 03: Facility Maintenance Blocks & Conflict Verification
-- List all active maintenance blocks and check if any intersect approved reservations

SELECT 
    b.Id AS BlockId,
    b.FacilityId,
    f.Name AS FacilityName,
    b.StartTime AS BlockStart,
    b.EndTime AS BlockEnd,
    b.Reason,
    u.FirstName + ' ' + u.LastName AS CreatedByManager
FROM FacilityMaintenanceBlocks b
INNER JOIN CommonFacilities f ON b.FacilityId = f.Id
INNER JOIN Users u ON b.CreatedByUserId = u.Id
ORDER BY b.StartTime DESC;

-- Check for conflicting approved reservations during maintenance blocks
SELECT 
    r.Id AS ConflictingReservationId,
    r.FacilityId,
    f.Name AS FacilityName,
    r.StartTime AS ReservationStart,
    r.EndTime AS ReservationEnd,
    b.Id AS MaintenanceBlockId,
    b.StartTime AS BlockStart,
    b.EndTime AS BlockEnd
FROM FacilityReservations r
INNER JOIN FacilityMaintenanceBlocks b ON r.FacilityId = b.FacilityId
INNER JOIN CommonFacilities f ON r.FacilityId = f.Id
WHERE r.Status IN ('PENDING', 'APPROVED')
  AND r.StartTime < b.EndTime
  AND r.EndTime > b.StartTime;
