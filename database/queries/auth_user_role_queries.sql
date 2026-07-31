-- ==============================================================================
-- Document: User & Role Queries Reference
-- Note: Operational and analytical queries for user management, role assignments,
-- inactive user listing, multi-role detection, and duplicate checks.
-- Safe to execute even when dbo.Users is currently empty.
-- ==============================================================================

USE ApartmentManagementDb;
GO

-- 1. List all Users with their assigned Roles
SELECT 
    u.Id AS UserId,
    u.UserName,
    u.Email,
    u.FirstName + ' ' + u.LastName AS FullName,
    u.IsActive AS UserIsActive,
    r.Code AS RoleCode,
    r.Name AS RoleName,
    ur.AssignedAt
FROM dbo.Users u
LEFT JOIN dbo.UserRoles ur ON u.Id = ur.UserId
LEFT JOIN dbo.Roles r ON ur.RoleId = r.Id
ORDER BY u.Id, r.Id;
GO

-- 2. Count of Active Users per Role
SELECT 
    r.Id AS RoleId,
    r.Code AS RoleCode,
    r.Name AS RoleName,
    COUNT(u.Id) AS ActiveUserCount
FROM dbo.Roles r
LEFT JOIN dbo.UserRoles ur ON r.Id = ur.RoleId
LEFT JOIN dbo.Users u ON ur.UserId = u.Id AND u.IsActive = 1
GROUP BY r.Id, r.Code, r.Name
ORDER BY r.Id;
GO

-- 3. Find Users without any assigned Role
SELECT 
    u.Id AS UserId,
    u.UserName,
    u.Email,
    u.FirstName,
    u.LastName,
    u.CreatedAt
FROM dbo.Users u
LEFT JOIN dbo.UserRoles ur ON u.Id = ur.UserId
WHERE ur.RoleId IS NULL;
GO

-- 4. List Inactive Users
SELECT 
    Id AS UserId,
    UserName,
    Email,
    FirstName,
    LastName,
    IsActive,
    CreatedAt,
    UpdatedAt
FROM dbo.Users
WHERE IsActive = 0
ORDER BY Id;
GO

-- 5. Find Users with multiple Roles (HAVING COUNT > 1)
SELECT 
    u.Id AS UserId,
    u.UserName,
    u.Email,
    COUNT(ur.RoleId) AS RoleCount,
    STRING_AGG(r.Code, ', ') AS AssignedRoleCodes
FROM dbo.Users u
INNER JOIN dbo.UserRoles ur ON u.Id = ur.UserId
INNER JOIN dbo.Roles r ON ur.RoleId = r.Id
GROUP BY u.Id, u.UserName, u.Email
HAVING COUNT(ur.RoleId) > 1;
GO

-- 6. Duplicate Email or UserName check query (Should return 0 rows)
SELECT 
    UserName, 
    COUNT(*) AS DuplicateCount
FROM dbo.Users
GROUP BY UserName
HAVING COUNT(*) > 1;

SELECT 
    Email, 
    COUNT(*) AS DuplicateCount
FROM dbo.Users
GROUP BY Email
HAVING COUNT(*) > 1;
GO

-- 7. Role and User Lookup for assignment dropdowns
SELECT Id AS RoleId, Code, Name FROM dbo.Roles WHERE IsActive = 1 ORDER BY Id;
SELECT Id AS UserId, UserName, Email, FirstName, LastName FROM dbo.Users WHERE IsActive = 1 ORDER BY Id;
GO
