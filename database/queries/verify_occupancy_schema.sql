-- ==============================================================================
-- Document: Occupancy Management Schema Verification Script
-- Note: Inspects OccupancyTypes and UnitOccupancies tables, columns, primary keys,
-- foreign keys, delete rules, indexes, check constraints, and seed data.
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
WHERE t.name IN ('OccupancyTypes', 'UnitOccupancies')
ORDER BY t.name, c.column_id;
GO

-- 2. Verify Primary Keys
SELECT 
    t.name AS TableName,
    i.name AS PrimaryKeyName,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS KeyColumns
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE i.is_primary_key = 1 AND t.name IN ('OccupancyTypes', 'UnitOccupancies')
GROUP BY t.name, i.name;
GO

-- 3. Verify Foreign Keys and Delete Actions on UnitOccupancies
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
WHERE tp.name = 'UnitOccupancies';
GO

-- 4. Verify Single and Composite Indexes
SELECT 
    t.name AS TableName,
    i.name AS IndexName,
    i.is_unique AS IsUnique,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS IndexedColumns
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('OccupancyTypes', 'UnitOccupancies') AND i.is_primary_key = 0
GROUP BY t.name, i.name, i.is_unique;
GO

-- 5. Verify Check Constraints on UnitOccupancies
SELECT 
    t.name AS TableName,
    cc.name AS CheckConstraintName,
    cc.definition AS ConstraintDefinition
FROM sys.check_constraints cc
INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'UnitOccupancies';
GO

-- 6. Inspect Seed Data in dbo.OccupancyTypes
SELECT 
    Id, 
    Code, 
    Name, 
    Description, 
    IsActive
FROM dbo.OccupancyTypes
ORDER BY Id;
GO
