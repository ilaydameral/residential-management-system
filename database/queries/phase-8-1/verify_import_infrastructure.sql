-- ==============================================================================
-- Document: Phase 8.1 Data Import & Migration Infrastructure Inspection Query
-- Note: Verifies schema, check constraints, foreign keys, and indexes for
-- dbo.ImportBatches and dbo.ImportRowLogs tables.
-- ==============================================================================

USE ApartmentManagementDb;
GO

PRINT '=============================================================================';
PRINT '1. Inspecting ImportBatches Table Structure & Foreign Keys';
PRINT '=============================================================================';

SELECT
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.ImportBatches')
ORDER BY c.column_id;

PRINT '=============================================================================';
PRINT '2. Inspecting ImportRowLogs Table Structure & Foreign Keys';
PRINT '=============================================================================';

SELECT
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.ImportRowLogs')
ORDER BY c.column_id;

PRINT '=============================================================================';
PRINT '3. Check Constraints for Import Batches & Row Logs';
PRINT '=============================================================================';

SELECT
    cc.name AS ConstraintName,
    OBJECT_NAME(cc.parent_object_id) AS TableName,
    cc.definition AS ConstraintDefinition
FROM sys.check_constraints cc
WHERE cc.parent_object_id IN (OBJECT_ID('dbo.ImportBatches'), OBJECT_ID('dbo.ImportRowLogs'));

PRINT '=============================================================================';
PRINT '4. Indexes Created on Import Tables';
PRINT '=============================================================================';

SELECT
    t.name AS TableName,
    i.name AS IndexName,
    i.type_desc AS IndexType,
    i.is_unique AS IsUnique
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('ImportBatches', 'ImportRowLogs')
ORDER BY t.name, i.name;
GO
