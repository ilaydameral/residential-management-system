-- Phase 9: Announcement Queries & Verification Script
-- This script contains analytical and verification queries for Phase 9 Announcement features.

-- 1. Property-Level Published Announcements
SELECT 
    a.Id,
    a.Title,
    a.Priority,
    a.Status,
    p.Name AS PropertyName,
    a.PublishedAt,
    u.FirstName + ' ' + u.LastName AS CreatedByName
FROM Announcements a
INNER JOIN Properties p ON a.PropertyId = p.Id
INNER JOIN Users u ON a.CreatedByUserId = u.Id
WHERE a.BuildingId IS NULL AND a.Status = 'PUBLISHED'
ORDER BY a.PublishedAt DESC;

-- 2. Building-Level Published Announcements
SELECT 
    a.Id,
    a.Title,
    a.Priority,
    a.Status,
    p.Name AS PropertyName,
    b.Name AS BuildingName,
    a.PublishedAt
FROM Announcements a
INNER JOIN Properties p ON a.PropertyId = p.Id
INNER JOIN Buildings b ON a.BuildingId = b.Id
WHERE a.BuildingId IS NOT NULL AND a.Status = 'PUBLISHED'
ORDER BY a.PublishedAt DESC;

-- 3. Announcement Status & Priority Distribution
SELECT 
    Status,
    Priority,
    COUNT(*) AS TotalCount
FROM Announcements
GROUP BY Status, Priority
ORDER BY Status, Priority;

-- 4. Target Resident Recipients Resolution Query (Property-Level Example)
-- Resolves distinct active resident user IDs for a given PropertyId (e.g. PropertyId = 1)
SELECT DISTINCT 
    uo.UserId,
    u.FirstName,
    u.LastName,
    u.Email,
    p.Name AS PropertyName,
    b.Name AS BuildingName,
    un.UnitNumber
FROM UnitOccupancies uo
INNER JOIN Users u ON uo.UserId = u.Id
INNER JOIN Units un ON uo.UnitId = un.Id
INNER JOIN Buildings b ON un.BuildingId = b.Id
INNER JOIN Properties p ON b.PropertyId = p.Id
WHERE uo.IsActive = 1 
  AND u.IsActive = 1
  AND (uo.EndDate IS NULL OR uo.EndDate > GETUTCDATE())
  AND p.Id = 1;

-- 5. Announcement -> Notification Relationship Check
SELECT 
    n.Id AS NotificationId,
    n.UserId,
    u.FirstName + ' ' + u.LastName AS RecipientName,
    n.Title AS NotificationTitle,
    n.NotificationType,
    n.RelatedEntityName,
    n.RelatedEntityId,
    n.IsRead,
    n.CreatedAt
FROM Notifications n
INNER JOIN Users u ON n.UserId = u.Id
WHERE n.NotificationType = 'ANNOUNCEMENT' AND n.RelatedEntityName = 'Announcement'
ORDER BY n.CreatedAt DESC;

-- 6. Duplicate Recipient Check for Announcement Notifications
SELECT 
    n.RelatedEntityId AS AnnouncementId,
    n.UserId,
    COUNT(*) AS NotificationCount
FROM Notifications n
WHERE n.NotificationType = 'ANNOUNCEMENT' AND n.RelatedEntityName = 'Announcement'
GROUP BY n.RelatedEntityId, n.UserId
HAVING COUNT(*) > 1;

-- 7. Cancelled Announcement Audit Check
SELECT 
    a.Id,
    a.Title,
    a.Status,
    a.CreatedAt,
    a.PublishedAt,
    a.CancelledAt
FROM Announcements a
WHERE a.Status = 'CANCELLED'
ORDER BY a.CancelledAt DESC;
