-- ==============================================================================
-- Document: UnitTypes Lookup Table Verification Script
-- Note: The single source of truth for deployment is the EF Core Migration 
-- (AddUnitTypesLookup). This SQL file is maintained for learning, 
-- manual inspection, testing, and documentation purposes.
-- ==============================================================================

USE ApartmentManagementDb;
GO

-- 1. List all records in dbo.UnitTypes
SELECT 
    Id, 
    Name, 
    Code, 
    Description, 
    IsActive, 
    CreatedAt
FROM dbo.UnitTypes
ORDER BY Id;
GO

-- 2. Check for duplicate Code values (Should return 0 rows)
SELECT 
    Code, 
    COUNT(*) AS DuplicateCount
FROM dbo.UnitTypes
GROUP BY Code
HAVING COUNT(*) > 1;
GO

-- 3. Verify presence of all expected seed records
SELECT 
    Id, 
    Code, 
    Name,
    CASE 
        WHEN Code IN ('APARTMENT', 'SHOP', 'OFFICE', 'STORAGE', 'PARKING_SPACE') THEN 'OK' 
        ELSE 'UNEXPECTED' 
    END AS SeedStatus
FROM dbo.UnitTypes;
GO

-- 4. Inspect table columns and data types via INFORMATION_SCHEMA
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH, 
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'UnitTypes'
ORDER BY ORDINAL_POSITION;
GO
