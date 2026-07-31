-- ==============================================================================
-- Document: Authentication & Authorization Schema Verification Script
-- Note: Single source of truth is EF Core Migration (AddAuthenticationEntities).
-- This script inspects Users, Roles, and UserRoles tables, columns, PKs, FKs,
-- unique indexes, delete rules, and seed roles.
-- ==============================================================================

USE ApartmentManagementDb;
GO

-- 1. Inspect Table Columns, Data Types, Max Lengths, and Nullability
SELECT 
    t.name AS TableName,
    c.name AS ColumnName,
    ty.name AS DataType,
    c.max_length AS MaxLengthInBytes,
    c.is_nullable AS IsNullable
FROM sys.tables t
INNER JOIN sys.columns c ON t.object_id = c.object_id
INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE t.name IN ('Users', 'Roles', 'UserRoles')
ORDER BY t.name, c.column_id;
GO

-- 2. Verify Primary Keys and Composite Keys
SELECT 
    t.name AS TableName,
    i.name AS PrimaryKeyName,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS KeyColumns
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE i.is_primary_key = 1 AND t.name IN ('Users', 'Roles', 'UserRoles')
GROUP BY t.name, i.name;
GO

-- 3. Verify Unique Indexes (UserName, Email, Role Code)
SELECT 
    t.name AS TableName,
    i.name AS IndexName,
    i.is_unique AS IsUnique,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS IndexedColumns
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('Users', 'Roles', 'UserRoles') AND i.is_unique = 1 AND i.is_primary_key = 0
GROUP BY t.name, i.name, i.is_unique;
GO

-- 4. Verify Foreign Keys and Delete Cascade Actions on UserRoles
SELECT 
    fk.name AS ForeignKeyName,
    tp.name AS ParentTable,
    cp.name AS ParentColumn,
    tr.name AS ReferencedTable,
    cr.name AS ReferencedColumn,
    fk.delete_referential_action_desc AS DeleteAction
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
WHERE tp.name = 'UserRoles';
GO

-- 5. Inspect Seed Data in dbo.Roles
SELECT 
    Id, 
    Code, 
    Name, 
    Description, 
    IsActive
FROM dbo.Roles
ORDER BY Id;
GO

-- 6. Verify UserRole Composite Key Definition (Should show UserId, RoleId)
SELECT 
    t.name AS TableName,
    i.name AS ConstraintName,
    c.name AS ColumnName,
    ic.key_ordinal AS ColumnOrdinal
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name = 'UserRoles' AND i.is_primary_key = 1
ORDER BY ic.key_ordinal;
GO
