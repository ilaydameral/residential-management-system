-- Phase 12 Verification Script 01: Common Area Facilities
-- Inspect configured facilities, active status, capacity, opening hours, and scope bindings

SELECT 
    f.Id AS FacilityId,
    f.Name AS FacilityName,
    p.Name AS PropertyName,
    b.Name AS BuildingName,
    f.Capacity,
    f.OpeningTime,
    f.ClosingTime,
    f.SlotDurationMinutes,
    f.RequiresManagerApproval,
    f.MaxActiveReservationsPerResident,
    f.CancellationLeadTimeHours,
    f.IsActive,
    f.CreatedAt
FROM CommonFacilities f
INNER JOIN Properties p ON f.PropertyId = p.Id
LEFT JOIN Buildings b ON f.BuildingId = b.Id
ORDER BY p.Name, f.Name;
