-- Phase 9: Maintenance Request Analytical & Verification Queries
-- This script contains queries for inspecting ticket distribution, workload, timeline history, and notification events.

-- 1. Status Distribution of Maintenance Requests
SELECT 
    Status,
    COUNT(*) AS TotalRequests
FROM MaintenanceRequests
GROUP BY Status
ORDER BY TotalRequests DESC;

-- 2. Category & Priority Matrix
SELECT 
    Category,
    Priority,
    COUNT(*) AS TotalRequests
FROM MaintenanceRequests
GROUP BY Category, Priority
ORDER BY Category, Priority;

-- 3. Open Requests Count by Property & Building
SELECT 
    p.Name AS PropertyName,
    b.Name AS BuildingName,
    COUNT(mr.Id) AS OpenRequestCount
FROM MaintenanceRequests mr
INNER JOIN Properties p ON mr.PropertyId = p.Id
INNER JOIN Buildings b ON mr.BuildingId = b.Id
WHERE mr.Status = 'OPEN'
GROUP BY p.Name, b.Name
ORDER BY OpenRequestCount DESC;

-- 4. Technical Staff Workload Analysis
SELECT 
    u.Id AS TechnicianId,
    u.FirstName + ' ' + u.LastName AS TechnicianName,
    mr.Status,
    COUNT(mr.Id) AS AssignedCount
FROM MaintenanceRequests mr
INNER JOIN Users u ON mr.AssignedToUserId = u.Id
GROUP BY u.Id, u.FirstName, u.LastName, mr.Status
ORDER BY TechnicianName, mr.Status;

-- 5. Overdue / Old Open Requests (Pending > 3 Days)
SELECT 
    mr.Id,
    mr.RequestNumber,
    mr.Title,
    mr.Priority,
    mr.CreatedAt,
    DATEDIFF(day, mr.CreatedAt, GETUTCDATE()) AS DaysPending
FROM MaintenanceRequests mr
WHERE mr.Status = 'OPEN' AND DATEDIFF(day, mr.CreatedAt, GETUTCDATE()) >= 3
ORDER BY mr.CreatedAt ASC;

-- 6. Maintenance Request Timeline History Query
SELECT 
    h.Id AS HistoryId,
    h.MaintenanceRequestId,
    mr.RequestNumber,
    h.ActionType,
    h.OldStatus,
    h.NewStatus,
    uOld.FirstName + ' ' + uOld.LastName AS OldTechnician,
    uNew.FirstName + ' ' + uNew.LastName AS NewTechnician,
    h.Note,
    uChg.FirstName + ' ' + uChg.LastName AS ChangedByName,
    h.CreatedAt
FROM MaintenanceRequestHistories h
INNER JOIN MaintenanceRequests mr ON h.MaintenanceRequestId = mr.Id
INNER JOIN Users uChg ON h.ChangedByUserId = uChg.Id
LEFT JOIN Users uOld ON h.OldAssignedToUserId = uOld.Id
LEFT JOIN Users uNew ON h.NewAssignedToUserId = uNew.Id
WHERE h.MaintenanceRequestId = 1
ORDER BY h.CreatedAt ASC;

-- 7. Request Attachments Metadata Query
SELECT 
    a.Id AS AttachmentId,
    a.MaintenanceRequestId,
    a.OriginalFileName,
    a.ContentType,
    a.FileSizeBytes,
    u.FirstName + ' ' + u.LastName AS UploadedByName,
    a.CreatedAt
FROM MaintenanceRequestAttachments a
INNER JOIN Users u ON a.UploadedByUserId = u.Id
ORDER BY a.CreatedAt DESC;

-- 8. Request Notification Events Log
SELECT 
    n.Id AS NotificationId,
    n.UserId,
    u.FirstName + ' ' + u.LastName AS RecipientName,
    n.Title,
    n.Message,
    n.NotificationType,
    n.RelatedEntityName,
    n.RelatedEntityId,
    n.IsRead,
    n.CreatedAt
FROM Notifications n
INNER JOIN Users u ON n.UserId = u.Id
WHERE n.NotificationType = 'REQUEST' AND n.RelatedEntityName = 'MaintenanceRequest'
ORDER BY n.CreatedAt DESC;
