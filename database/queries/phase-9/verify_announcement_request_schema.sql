-- Phase 9: Announcements & Maintenance Requests Schema Verification Script
-- This query verifies tables, columns, indexes, foreign keys, and check constraints for Phase 9.

-- 1. Table Verification
SELECT TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN ('Announcements', 'MaintenanceRequests', 'MaintenanceRequestHistories', 'MaintenanceRequestAttachments')
ORDER BY TABLE_NAME;

-- 2. Columns & Data Types Verification
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('Announcements', 'MaintenanceRequests', 'MaintenanceRequestHistories', 'MaintenanceRequestAttachments')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 3. Foreign Key & Delete Behavior Verification
SELECT 
    fk.name AS ForeignKeyName,
    tp.name AS ParentTable,
    cp.name AS ParentColumn,
    tr.name AS ReferencedTable,
    cr.name AS ReferencedColumn,
    fk.delete_referential_action_desc AS DeleteBehavior
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
WHERE tp.name IN ('Announcements', 'MaintenanceRequests', 'MaintenanceRequestHistories', 'MaintenanceRequestAttachments')
ORDER BY tp.name, fk.name;

-- 4. Index & Unique Constraint Verification
SELECT 
    t.name AS TableName,
    i.name AS IndexName,
    i.is_unique AS IsUnique,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS Columns
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE t.name IN ('Announcements', 'MaintenanceRequests', 'MaintenanceRequestHistories', 'MaintenanceRequestAttachments')
  AND i.name IS NOT NULL
GROUP BY t.name, i.name, i.is_unique
ORDER BY t.name, i.name;

-- 5. Check Constraint Verification
SELECT 
    t.name AS TableName,
    cc.name AS ConstraintName,
    cc.definition AS ConstraintDefinition
FROM sys.check_constraints cc
INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name IN ('Announcements', 'MaintenanceRequests', 'MaintenanceRequestHistories', 'MaintenanceRequestAttachments')
ORDER BY t.name, cc.name;
