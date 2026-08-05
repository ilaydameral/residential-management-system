-- ==============================================================================
-- Document: Manager Assignment Schema Verification Script
-- Note: Read-only checks for the ManagerAssignments table and migration history.
-- ==============================================================================

-- 1. Verify the table exists.
SELECT
    s.name AS SchemaName,
    t.name AS TableName
FROM sys.tables AS t
INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
WHERE t.name = 'ManagerAssignments';

-- 2. Verify column types, lengths, and nullability.
SELECT
    c.column_id AS ColumnOrder,
    c.name AS ColumnName,
    ty.name AS DataType,
    CASE
        WHEN ty.name IN ('nvarchar', 'nchar') AND c.max_length > 0 THEN c.max_length / 2
        ELSE c.max_length
    END AS MaxLength,
    c.is_nullable AS IsNullable
FROM sys.columns AS c
INNER JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.ManagerAssignments')
ORDER BY c.column_id;

-- 3. Verify all five foreign keys use NO_ACTION (SQL Server Restrict behavior).
SELECT
    fk.name AS ForeignKeyName,
    parentColumn.name AS ParentColumn,
    referencedTable.name AS ReferencedTable,
    referencedColumn.name AS ReferencedColumn,
    fk.delete_referential_action_desc AS DeleteAction
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id
INNER JOIN sys.columns AS parentColumn
    ON parentColumn.object_id = fkc.parent_object_id
    AND parentColumn.column_id = fkc.parent_column_id
INNER JOIN sys.tables AS referencedTable ON referencedTable.object_id = fkc.referenced_object_id
INNER JOIN sys.columns AS referencedColumn
    ON referencedColumn.object_id = fkc.referenced_object_id
    AND referencedColumn.column_id = fkc.referenced_column_id
WHERE fk.parent_object_id = OBJECT_ID(N'dbo.ManagerAssignments')
ORDER BY fk.name;

-- 4. Verify active/end-state and date check constraints.
SELECT
    cc.name AS CheckConstraintName,
    cc.definition AS ConstraintDefinition,
    cc.is_disabled AS IsDisabled,
    cc.is_not_trusted AS IsNotTrusted
FROM sys.check_constraints AS cc
WHERE cc.parent_object_id = OBJECT_ID(N'dbo.ManagerAssignments')
ORDER BY cc.name;

-- 5. Verify index names, ordered columns, uniqueness, and exact filters.
-- Expected total: seven non-primary-key indexes.
-- EF Core FK convention:
--   IX_ManagerAssignments_AssignedByUserId
--   IX_ManagerAssignments_EndedByUserId
-- Explicit supporting indexes:
--   IX_ManagerAssignments_ManagerUserId_IsActive
--   IX_ManagerAssignments_PropertyId_IsActive
--   IX_ManagerAssignments_BuildingId_IsActive
-- Filtered unique indexes:
--   IX_ManagerAssignments_ManagerUserId_PropertyId
--   IX_ManagerAssignments_ManagerUserId_BuildingId
SELECT
    i.name AS IndexName,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS IndexedColumns,
    i.is_unique AS IsUnique,
    i.has_filter AS HasFilter,
    i.filter_definition AS FilterDefinition
FROM sys.indexes AS i
INNER JOIN sys.index_columns AS ic
    ON ic.object_id = i.object_id
    AND ic.index_id = i.index_id
    AND ic.is_included_column = 0
INNER JOIN sys.columns AS c
    ON c.object_id = ic.object_id
    AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(N'dbo.ManagerAssignments')
    AND i.is_primary_key = 0
GROUP BY i.name, i.is_unique, i.has_filter, i.filter_definition
ORDER BY i.name;

-- Expected filtered unique definitions:
-- [IsActive] = 1 AND [BuildingId] IS NULL
-- [IsActive] = 1 AND [BuildingId] IS NOT NULL

-- 6. Verify the migration history record.
SELECT
    MigrationId,
    ProductVersion
FROM dbo.__EFMigrationsHistory
WHERE MigrationId LIKE '%_AddManagerAssignments';
