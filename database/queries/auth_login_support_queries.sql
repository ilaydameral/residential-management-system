-- ==============================================================================
-- Document: Authentication & Login Support Queries Reference
-- Note: Operational queries to support login troubleshooting, user role lookup,
-- admin account verification, and account status inspection.
-- PasswordHash column is intentionally excluded from all SELECT statements.
-- ==============================================================================

USE ApartmentManagementDb;
GO

-- 1. Lookup User by UserName or Email (Case-Insensitive)
DECLARE @SearchInput NVARCHAR(150) = N'admin';

SELECT 
    u.Id AS UserId,
    u.UserName,
    u.Email,
    u.FirstName,
    u.LastName,
    u.IsActive,
    u.CreatedAt,
    u.UpdatedAt
FROM dbo.Users u
WHERE LOWER(u.UserName) = LOWER(@SearchInput) OR LOWER(u.Email) = LOWER(@SearchInput);
GO

-- 2. List Active Roles of a Specific User via JOIN
SELECT 
    u.Id AS UserId,
    u.UserName,
    u.Email,
    r.Id AS RoleId,
    r.Code AS RoleCode,
    r.Name AS RoleName,
    r.IsActive AS RoleIsActive,
    ur.AssignedAt
FROM dbo.Users u
INNER JOIN dbo.UserRoles ur ON u.Id = ur.UserId
INNER JOIN dbo.Roles r ON ur.RoleId = r.Id
WHERE u.UserName = N'admin' AND r.IsActive = 1;
GO

-- 3. List All Users with ADMIN Role Assigned
SELECT 
    u.Id AS UserId,
    u.UserName,
    u.Email,
    u.FirstName + ' ' + u.LastName AS FullName,
    u.IsActive AS UserIsActive,
    r.Code AS RoleCode,
    ur.AssignedAt
FROM dbo.Users u
INNER JOIN dbo.UserRoles ur ON u.Id = ur.UserId
INNER JOIN dbo.Roles r ON ur.RoleId = r.Id
WHERE r.Code = N'ADMIN'
ORDER BY u.Id;
GO

-- 4. Find Users without any Assigned Roles
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

-- 5. Find Inactive Users (Blocked from Login)
SELECT 
    u.Id AS UserId,
    u.UserName,
    u.Email,
    u.FirstName,
    u.LastName,
    u.IsActive,
    u.CreatedAt,
    u.UpdatedAt
FROM dbo.Users u
WHERE u.IsActive = 0;
GO

-- 6. List Recently Registered/Created Users Ordered by CreatedAt DESC
SELECT TOP 10
    u.Id AS UserId,
    u.UserName,
    u.Email,
    u.FirstName,
    u.LastName,
    u.IsActive,
    u.CreatedAt
FROM dbo.Users u
ORDER BY u.CreatedAt DESC;
GO
