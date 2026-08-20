-- ============================================================================
-- PHASE 10 COMMIT 5A: GLOBAL SEARCH VERIFICATION SQL
-- Inspection queries for scoped search verification
-- ============================================================================

-- 1. Property Search Inspection
SELECT Id, Name, IsActive, CreatedAt
FROM Properties
WHERE Name LIKE '%Olbia%'
ORDER BY Name;

-- 2. Building Search Inspection
SELECT b.Id, b.Name, b.Code, p.Name AS PropertyName
FROM Buildings b
INNER JOIN Properties p ON b.PropertyId = p.Id
WHERE b.Name LIKE '%A%' OR b.Code LIKE '%A%'
ORDER BY b.Name;

-- 3. Unit Search Inspection
SELECT u.Id, u.UnitNumber, b.Name AS BuildingName, p.Name AS PropertyName
FROM Units u
INNER JOIN Buildings b ON u.BuildingId = b.Id
INNER JOIN Properties p ON b.PropertyId = p.Id
WHERE u.UnitNumber LIKE '%101%' OR b.Name LIKE '%A%'
ORDER BY u.UnitNumber;

-- 4. Active Resident Occupancy Search (Manager Scope User Resolution)
SELECT DISTINCT u.Id AS UserId, u.FirstName, u.LastName, u.Email, o.UnitId, b.Name AS BuildingName
FROM Users u
INNER JOIN UnitOccupancies o ON u.Id = o.UserId
INNER JOIN Units un ON o.UnitId = un.Id
INNER JOIN Buildings b ON un.BuildingId = b.Id
WHERE o.IsActive = 1
  AND (o.EndDate IS NULL OR o.EndDate > GETUTCDATE())
  AND (u.FirstName LIKE '%Ahmet%' OR u.LastName LIKE '%Yılmaz%' OR u.Email LIKE '%ahmet%')
ORDER BY u.FirstName, u.LastName;

-- 5. Maintenance Request Search Inspection
SELECT m.Id, m.RequestNumber, m.Title, m.Status, b.Name AS BuildingName, p.Name AS PropertyName
FROM MaintenanceRequests m
INNER JOIN Buildings b ON m.BuildingId = b.Id
INNER JOIN Properties p ON b.PropertyId = p.Id
WHERE m.RequestNumber LIKE '%REQ%' OR m.Title LIKE '%Sızıntı%'
ORDER BY m.CreatedAt DESC;

-- 6. Announcement Search Inspection
SELECT a.Id, a.Title, p.Name AS PropertyName, b.Name AS BuildingName, a.Status
FROM Announcements a
INNER JOIN Properties p ON a.PropertyId = p.Id
LEFT JOIN Buildings b ON a.BuildingId = b.Id
WHERE a.Title LIKE '%Bakım%'
ORDER BY a.CreatedAt DESC;
