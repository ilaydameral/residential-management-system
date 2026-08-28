-- Phase 12 Verification Script 02: Reservation Overlap & Conflict Check
-- Find any overlapping active reservations (PENDING or APPROVED) for the same facility

SELECT 
    r1.Id AS Reservation1Id,
    r1.FacilityId,
    f.Name AS FacilityName,
    r1.ResidentUserId AS Resident1Id,
    r1.StartTime AS Start1,
    r1.EndTime AS End1,
    r1.Status AS Status1,
    r2.Id AS Reservation2Id,
    r2.ResidentUserId AS Resident2Id,
    r2.StartTime AS Start2,
    r2.EndTime AS End2,
    r2.Status AS Status2
FROM FacilityReservations r1
INNER JOIN FacilityReservations r2 ON r1.FacilityId = r2.FacilityId AND r1.Id < r2.Id
INNER JOIN CommonFacilities f ON r1.FacilityId = f.Id
WHERE r1.Status IN ('PENDING', 'APPROVED')
  AND r2.Status IN ('PENDING', 'APPROVED')
  AND r1.StartTime < r2.EndTime
  AND r1.EndTime > r2.StartTime;
