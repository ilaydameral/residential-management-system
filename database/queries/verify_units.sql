-- ==============================================================================
-- Document: Units Table Verification Script
-- Note: The single source of truth for deployment is the EF Core Migration 
-- (AddUnits). This SQL file is maintained for learning, 
-- manual inspection, testing, and documentation purposes.
-- ==============================================================================

USE ApartmentManagementDb;
GO

-- 1. List all records in dbo.Units JOINed with Buildings and UnitTypes
SELECT 
    u.Id,
    u.UnitNumber,
    u.FloorNumber,
    u.GrossArea,
    u.NetArea,
    b.Name AS BuildingName,
    ut.Name AS UnitTypeName,
    u.IsActive,
    u.CreatedAt
FROM dbo.Units u
INNER JOIN dbo.Buildings b ON u.BuildingId = b.Id
INNER JOIN dbo.UnitTypes ut ON u.UnitTypeId = ut.Id
ORDER BY u.Id;
GO

-- 2. Inspect table columns, data types, max length, precision, scale, and nullability
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH, 
    NUMERIC_PRECISION, 
    NUMERIC_SCALE, 
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Units'
ORDER BY ORDINAL_POSITION;
GO

-- 3. Verify Foreign Keys (BuildingId and UnitTypeId) details
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
WHERE tp.name = 'Units';
GO

-- 4. Verify (BuildingId, UnitNumber) Composite Unique Index
SELECT 
    i.name AS IndexName,
    i.is_unique AS IsUnique,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS IndexedColumns
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name = 'Units' AND i.is_unique = 1 AND i.is_primary_key = 0
GROUP BY i.name, i.is_unique;
GO

-- 5. Verify Check Constraints via sys.check_constraints
SELECT 
    cc.name AS ConstraintName,
    t.name AS TableName,
    cc.definition AS CheckDefinition,
    cc.is_disabled AS IsDisabled
FROM sys.check_constraints cc
INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'Units';
GO

-- 6. Check for duplicate (BuildingId, UnitNumber) combinations (Should return 0 rows)
SELECT 
    BuildingId, 
    UnitNumber, 
    COUNT(*) AS DuplicateCount
FROM dbo.Units
GROUP BY BuildingId, UnitNumber
HAVING COUNT(*) > 1;
GO

-- 7. Check for orphan Unit records without Building
SELECT 
    u.Id AS UnitId, 
    u.UnitNumber, 
    u.BuildingId
FROM dbo.Units u
LEFT JOIN dbo.Buildings b ON u.BuildingId = b.Id
WHERE b.Id IS NULL;
GO

-- 8. Check for orphan Unit records without UnitType
SELECT 
    u.Id AS UnitId, 
    u.UnitNumber, 
    u.UnitTypeId
FROM dbo.Units u
LEFT JOIN dbo.UnitTypes ut ON u.UnitTypeId = ut.Id
WHERE ut.Id IS NULL;
GO

-- 9. Verify 0 seed Unit records exist
SELECT COUNT(*) AS SeedUnitCount FROM dbo.Units;
GO
