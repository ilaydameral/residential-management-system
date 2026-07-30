-- ==============================================================================
-- Document: PropertyType String Data Migration Script
-- Note: The single source of truth for deployment is the EF Core Migration 
-- (MigratePropertyTypeData). This SQL file is maintained for learning, 
-- manual inspection, testing, and documentation purposes.
-- ==============================================================================

USE ApartmentManagementDb;
GO

-- 1. Inspect existing PropertyType values and record counts
SELECT 
    PropertyType, 
    COUNT(*) AS RecordCount
FROM dbo.Properties
GROUP BY PropertyType
ORDER BY PropertyType;
GO

-- 2. Preview mapping before running UPDATE
SELECT 
    p.Id,
    p.Name,
    p.PropertyType AS CurrentStringValue,
    pt.Id AS TargetPropertyTypeId,
    pt.Code AS TargetPropertyTypeCode,
    pt.Name AS TargetPropertyTypeName
FROM dbo.Properties p
LEFT JOIN dbo.PropertyTypes pt
    ON (p.PropertyType = N'Residential Complex' AND pt.Code = N'RESIDENTIAL_COMPLEX')
    OR (p.PropertyType = N'Apartment Building' AND pt.Code = N'SINGLE_APARTMENT');
GO

-- 3. Execute data migration UPDATE statement
UPDATE p
SET p.PropertyTypeId = pt.Id
FROM dbo.Properties p
INNER JOIN dbo.PropertyTypes pt
    ON (p.PropertyType = N'Residential Complex' AND pt.Code = N'RESIDENTIAL_COMPLEX')
    OR (p.PropertyType = N'Apartment Building' AND pt.Code = N'SINGLE_APARTMENT')
WHERE p.PropertyTypeId IS NULL;
GO

-- 4. Check for unmatched records (Should return 0 rows)
SELECT 
    Id, 
    Name, 
    PropertyType, 
    PropertyTypeId
FROM dbo.Properties
WHERE PropertyTypeId IS NULL;
GO

-- 5. Validate successful data migration with JOIN
SELECT 
    p.Id,
    p.Name,
    p.PropertyType AS OldStringPropertyType,
    p.PropertyTypeId,
    pt.Code AS NewPropertyTypeCode,
    pt.Name AS NewPropertyTypeName
FROM dbo.Properties p
INNER JOIN dbo.PropertyTypes pt ON p.PropertyTypeId = pt.Id;
GO
