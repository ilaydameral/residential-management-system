-- ==============================================================================
-- Document: Phase 8 Financial Database Schema Verification Script
-- Note: Read-only verification for financial tables, column types, foreign keys,
-- check constraints, and indexes created in Phase 8 Commit 1.
-- ==============================================================================

USE ApartmentManagementDb;
GO

PRINT '=============================================================================';
PRINT '1. Table Existence Verification';
PRINT '=============================================================================';

SELECT 
    t.name AS TableName,
    t.create_date AS CreatedAt
FROM sys.tables t
WHERE t.name IN (
    'DueDefinitions',
    'DuePeriods',
    'UnitCharges',
    'Expenses',
    'Payments',
    'PaymentSubmissions',
    'Notifications'
)
ORDER BY t.name;
GO

PRINT '=============================================================================';
PRINT '2. Column Data Types & Precision Verification';
PRINT '=============================================================================';

SELECT 
    t.name AS TableName,
    c.name AS ColumnName,
    type_name(c.user_type_id) AS DataType,
    c.max_length AS MaxLength,
    c.precision AS NumericPrecision,
    c.scale AS NumericScale,
    c.is_nullable AS IsNullable
FROM sys.columns c
INNER JOIN sys.tables t ON c.object_id = t.object_id
WHERE t.name IN (
    'DueDefinitions',
    'DuePeriods',
    'UnitCharges',
    'Expenses',
    'Payments',
    'PaymentSubmissions',
    'Notifications'
)
AND (c.name LIKE '%Amount%' OR c.name LIKE '%Status%' OR c.name LIKE '%Type%')
ORDER BY t.name, c.name;
GO

PRINT '=============================================================================';
PRINT '3. Foreign Key Constraints Verification';
PRINT '=============================================================================';

SELECT 
    fk.name AS ForeignKeyName,
    tp.name AS ParentTable,
    cp.name AS ParentColumn,
    tr.name AS ReferencedTable,
    cr.name AS ReferencedColumn,
    fk.delete_referential_action_desc AS DeleteRule
FROM sys.foreign_keys fk
INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
WHERE tp.name IN (
    'DueDefinitions',
    'DuePeriods',
    'UnitCharges',
    'Expenses',
    'Payments',
    'PaymentSubmissions',
    'Notifications'
)
ORDER BY tp.name, fk.name;
GO

PRINT '=============================================================================';
PRINT '4. Check Constraints Verification';
PRINT '=============================================================================';

SELECT 
    t.name AS TableName,
    cc.name AS ConstraintName,
    cc.definition AS ConstraintDefinition
FROM sys.check_constraints cc
INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name IN (
    'DueDefinitions',
    'DuePeriods',
    'UnitCharges',
    'Expenses',
    'Payments',
    'PaymentSubmissions',
    'Notifications'
)
ORDER BY t.name, cc.name;
GO

PRINT '=============================================================================';
PRINT '5. Indexes Verification';
PRINT '=============================================================================';

SELECT 
    t.name AS TableName,
    i.name AS IndexName,
    i.type_desc AS IndexType,
    i.is_unique AS IsUnique,
    i.has_filter AS HasFilter,
    i.filter_definition AS FilterDefinition
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN (
    'DueDefinitions',
    'DuePeriods',
    'UnitCharges',
    'Expenses',
    'Payments',
    'PaymentSubmissions',
    'Notifications'
)
AND i.name NOT LIKE 'PK_%'
ORDER BY t.name, i.name;
GO
