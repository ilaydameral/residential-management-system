-- ==============================================================================
-- Document: Buildings Table Verification Script
-- Note: The single source of truth for deployment is the EF Core Migration 
-- (AddBuildings). This SQL file is maintained for learning, 
-- manual inspection, testing, and documentation purposes.
-- ==============================================================================

USE ApartmentManagementDb;
GO

-- 1. List all records in dbo.Buildings
SELECT 
    Id, 
    PropertyId, 
    Name, 
    Code, 
    FloorCount, 
    Description, 
    IsActive, 
    CreatedAt, 
    UpdatedAt
FROM dbo.Buildings
ORDER BY Id;
GO

-- 2. Inspect table columns, data types, max lengths, and nullability
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH, 
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Buildings'
ORDER BY ORDINAL_POSITION;
GO

-- 3. Verify Foreign Key (FK_Buildings_Properties_PropertyId) details
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
WHERE tp.name = 'Buildings';
GO

-- 4. Verify (PropertyId, Code) Composite Unique Index
SELECT 
    i.name AS IndexName,
    i.is_unique AS IsUnique,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS IndexedColumns
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name = 'Buildings' AND i.is_unique = 1 AND i.is_primary_key = 0
GROUP BY i.name, i.is_unique;
GO

-- 5. Check for duplicate (PropertyId, Code) combinations (Should return 0 rows)
SELECT 
    PropertyId, 
    Code, 
    COUNT(*) AS DuplicateCount
FROM dbo.Buildings
GROUP BY PropertyId, Code
HAVING COUNT(*) > 1;
GO

-- 6. Check for orphan Building records (PropertyId missing in dbo.Properties)
SELECT 
    b.Id AS BuildingId, 
    b.Name AS BuildingName, 
    b.PropertyId
FROM dbo.Buildings b
LEFT JOIN dbo.Properties p ON b.PropertyId = p.Id
WHERE p.Id IS NULL;
GO

-- 7. Verify Check Constraint (CK_Buildings_FloorCount_Range) via sys.check_constraints
SELECT 
    cc.name AS ConstraintName,
    t.name AS TableName,
    cc.definition AS CheckDefinition,
    cc.is_disabled AS IsDisabled
FROM sys.check_constraints cc
INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'Buildings';
GO
