-- ============================================================================
-- PHASE 10: Building Floor Map Demo Dataset (IDEMPOTENT & SAFE)
-- Purpose: Provides a rich, realistic dataset for Floor Map UI visual validation.
-- ============================================================================

SET NOCOUNT ON;

-- 1. IDENTIFY OR CREATE DEMO RESIDENT USERS
DECLARE @PasswordHash NVARCHAR(MAX);
SELECT TOP 1 @PasswordHash = PasswordHash FROM Users WHERE PasswordHash IS NOT NULL;
IF @PasswordHash IS NULL SET @PasswordHash = 'AQAAAAIAAYagAAAAEO9z60g30hWd6mG7N2eY8f9+xY9k+w=='; -- Fallback hash

DECLARE @ResidentRoleId INT;
SELECT TOP 1 @ResidentRoleId = Id FROM Roles WHERE Code = 'RESIDENT';

IF OBJECT_ID('tempdb..#DemoUsers') IS NOT NULL DROP TABLE #DemoUsers;
CREATE TABLE #DemoUsers (
    UserName NVARCHAR(50),
    Email NVARCHAR(100),
    FirstName NVARCHAR(50),
    LastName NVARCHAR(50)
);

INSERT INTO #DemoUsers (UserName, Email, FirstName, LastName)
SELECT 'floor_demo_ahmet',  'floor.demo.ahmet@example.com',  N'Ahmet',  N'Yılmaz'
UNION ALL SELECT 'floor_demo_zeynep', 'floor.demo.zeynep@example.com', N'Zeynep', N'Kaya'
UNION ALL SELECT 'floor_demo_mehmet', 'floor.demo.mehmet@example.com', N'Mehmet', N'Demir'
UNION ALL SELECT 'floor_demo_elif',   'floor.demo.elif@example.com',   N'Elif',   N'Arslan'
UNION ALL SELECT 'floor_demo_can',    'floor.demo.can@example.com',    N'Can',    N'Aydın'
UNION ALL SELECT 'floor_demo_selin',  'floor.demo.selin@example.com',  N'Selin',  N'Koç'
UNION ALL SELECT 'floor_demo_burak',  'floor.demo.burak@example.com',  N'Burak',  N'Şahin'
UNION ALL SELECT 'floor_demo_ece',    'floor.demo.ece@example.com',    N'Ece',    N'Çelik';

DECLARE @UName NVARCHAR(50), @UEmail NVARCHAR(100), @UFName NVARCHAR(50), @ULName NVARCHAR(50), @UId INT;

DECLARE user_cursor CURSOR FOR SELECT UserName, Email, FirstName, LastName FROM #DemoUsers;
OPEN user_cursor;
FETCH NEXT FROM user_cursor INTO @UName, @UEmail, @UFName, @ULName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @UId = NULL;
    SELECT @UId = Id FROM Users WHERE Email = @UEmail OR UserName = @UName;
    IF @UId IS NULL
    BEGIN
        INSERT INTO Users (UserName, Email, FirstName, LastName, PasswordHash, IsActive, CreatedAt)
        VALUES (@UName, @UEmail, @UFName, @ULName, @PasswordHash, 1, GETUTCDATE());
        SET @UId = SCOPE_IDENTITY();

        IF @ResidentRoleId IS NOT NULL
        BEGIN
            INSERT INTO UserRoles (UserId, RoleId, AssignedAt) VALUES (@UId, @ResidentRoleId, GETUTCDATE());
        END
    END
    FETCH NEXT FROM user_cursor INTO @UName, @UEmail, @UFName, @ULName;
END;
CLOSE user_cursor;
DEALLOCATE user_cursor;
DROP TABLE #DemoUsers;

-- 2. IDENTIFY PROPERTY & PROPERTY TYPE
DECLARE @PropertyTypeId INT;
SELECT TOP 1 @PropertyTypeId = Id FROM PropertyTypes WHERE Code = 'SITE' OR Code = 'APARTMENT';
IF @PropertyTypeId IS NULL SELECT TOP 1 @PropertyTypeId = Id FROM PropertyTypes;

DECLARE @PropertyId INT;
SELECT @PropertyId = Id FROM Properties WHERE Name = N'Floor Map Demo Residence';

IF @PropertyId IS NULL
BEGIN
    INSERT INTO Properties (Name, PropertyTypeId, PropertyType, AddressLine, City, District, Description, IsActive, CreatedAt)
    VALUES (N'Floor Map Demo Residence', @PropertyTypeId, 'SITE', N'Demo Mh. Kat Planı Cd. No:10', N'Antalya', N'Muratpaşa', N'Kat Planı görsel doğrulama için özel demo veri kümesi.', 1, GETUTCDATE());

    SET @PropertyId = SCOPE_IDENTITY();
END

-- 3. IDENTIFY UNIT TYPE
DECLARE @UnitTypeId INT;
SELECT TOP 1 @UnitTypeId = Id FROM UnitTypes WHERE Code = 'APARTMENT' OR Name LIKE '%Daire%';
IF @UnitTypeId IS NULL SELECT TOP 1 @UnitTypeId = Id FROM UnitTypes;

-- 4. CREATE BUILDINGS
DECLARE @BuildingAId INT, @BuildingBId INT;

SELECT @BuildingAId = Id FROM Buildings WHERE PropertyId = @PropertyId AND Code = 'BLDG_DEMO_A';
IF @BuildingAId IS NULL
BEGIN
    INSERT INTO Buildings (PropertyId, Name, Code, FloorCount, Description, IsActive, CreatedAt)
    VALUES (@PropertyId, N'A Blok', 'BLDG_DEMO_A', 4, N'Floor Map Demo A Blok', 1, GETUTCDATE());
    SET @BuildingAId = SCOPE_IDENTITY();
END

SELECT @BuildingBId = Id FROM Buildings WHERE PropertyId = @PropertyId AND Code = 'BLDG_DEMO_B';
IF @BuildingBId IS NULL
BEGIN
    INSERT INTO Buildings (PropertyId, Name, Code, FloorCount, Description, IsActive, CreatedAt)
    VALUES (@PropertyId, N'B Blok', 'BLDG_DEMO_B', 4, N'Floor Map Demo B Blok', 1, GETUTCDATE());
    SET @BuildingBId = SCOPE_IDENTITY();
END

-- 5. HELPER TABLE FOR UNITS DEMO SETUP
IF OBJECT_ID('tempdb..#DemoUnits') IS NOT NULL DROP TABLE #DemoUnits;

CREATE TABLE #DemoUnits (
    UnitNumber NVARCHAR(50),
    FloorNumber INT,
    OccupancyCode VARCHAR(20),
    PrimaryUserEmail NVARCHAR(100),
    SecondaryUserEmail NVARCHAR(100),
    DebtAmount DECIMAL(18,2),
    IsOverdue BIT,
    MaintPriority VARCHAR(20),
    MaintCategory VARCHAR(50),
    MaintTitle NVARCHAR(200)
);

INSERT INTO #DemoUnits (UnitNumber, FloorNumber, OccupancyCode, PrimaryUserEmail, SecondaryUserEmail, DebtAmount, IsOverdue, MaintPriority, MaintCategory, MaintTitle)
SELECT N'401', 4, 'OCCUPIED_OWNER',  'floor.demo.ahmet@example.com',  'floor.demo.ece@example.com', 0.00,    0, CAST(NULL AS VARCHAR(20)), CAST(NULL AS VARCHAR(50)), CAST(NULL AS NVARCHAR(200))
UNION ALL SELECT N'402', 4, 'OCCUPIED_TENANT', 'floor.demo.zeynep@example.com', NULL, 2500.00, 0, 'NORMAL',   'HEATING_COOLING', N'Klima Filtre Temizliği ve Bakımı'
UNION ALL SELECT N'403', 4, 'VACANT',          NULL,                            NULL, 0.00,    0, NULL,        NULL,             NULL
UNION ALL SELECT N'301', 3, 'OCCUPIED_OWNER',  'floor.demo.mehmet@example.com', NULL, 4250.00, 1, NULL,        NULL,             NULL
UNION ALL SELECT N'302', 3, 'OCCUPIED_TENANT', 'floor.demo.elif@example.com',   NULL, 0.00,    0, 'HIGH',     'PLUMBING',       N'Banyo Tavanında Su Sızıntısı'
UNION ALL SELECT N'303', 3, 'VACANT',          NULL,                            NULL, 0.00,    0, NULL,        NULL,             NULL
UNION ALL SELECT N'201', 2, 'OCCUPIED_OWNER',  'floor.demo.can@example.com',    NULL, 6800.00, 1, 'EMERGENCY','PLUMBING',       N'Ana Su Vanası Patlaması - Acil Müdahale'
UNION ALL SELECT N'202', 2, 'OCCUPIED_TENANT', 'floor.demo.selin@example.com',  NULL, 0.00,    0, NULL,        NULL,             NULL
UNION ALL SELECT N'203', 2, 'VACANT',          NULL,                            NULL, 0.00,    0, NULL,        NULL,             NULL
UNION ALL SELECT N'101', 0, 'OCCUPIED_OWNER',  'floor.demo.burak@example.com',  NULL, 1200.00, 0, NULL,        NULL,             NULL
UNION ALL SELECT N'102', 0, 'VACANT',          NULL,                            NULL, 0.00,    0, NULL,        NULL,             NULL
UNION ALL SELECT N'103', 0, 'VACANT',          NULL,                            NULL, 0.00,    0, NULL,        NULL,             NULL;

-- 6. SEED UNITS, OCCUPANCIES, CHARGES, MAINTENANCE REQUESTS
DECLARE @OwnerOccupancyTypeId INT, @TenantOccupancyTypeId INT;
SELECT TOP 1 @OwnerOccupancyTypeId = Id FROM OccupancyTypes WHERE Code = 'OWNER' OR Name LIKE '%Malik%';
SELECT TOP 1 @TenantOccupancyTypeId = Id FROM OccupancyTypes WHERE Code = 'TENANT' OR Name LIKE '%Kiracı%';
IF @OwnerOccupancyTypeId IS NULL SELECT TOP 1 @OwnerOccupancyTypeId = Id FROM OccupancyTypes;
IF @TenantOccupancyTypeId IS NULL SET @TenantOccupancyTypeId = @OwnerOccupancyTypeId;

DECLARE @UnitId INT, @UnitNum NVARCHAR(50), @FloorNum INT, @OccCode VARCHAR(20), @PEmail NVARCHAR(100), @SEmail NVARCHAR(100), @Debt DECIMAL(18,2), @IsOverdue BIT, @MPriority VARCHAR(20), @MCategory VARCHAR(50), @MTitle NVARCHAR(200);
DECLARE @OccTypeId INT, @PrimaryUserId INT, @SecondaryUserId INT, @DueDate DATETIME, @CreatorUserId INT, @ReqNum NVARCHAR(50), @ReqUserId INT;

DECLARE demo_cursor CURSOR FOR
SELECT UnitNumber, FloorNumber, OccupancyCode, PrimaryUserEmail, SecondaryUserEmail, DebtAmount, IsOverdue, MaintPriority, MaintCategory, MaintTitle
FROM #DemoUnits;

OPEN demo_cursor;
FETCH NEXT FROM demo_cursor INTO @UnitNum, @FloorNum, @OccCode, @PEmail, @SEmail, @Debt, @IsOverdue, @MPriority, @MCategory, @MTitle;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @UnitId = NULL;
    SET @PrimaryUserId = NULL;
    SET @SecondaryUserId = NULL;
    SET @CreatorUserId = NULL;
    SET @ReqUserId = NULL;

    SELECT @UnitId = Id FROM Units WHERE BuildingId = @BuildingAId AND UnitNumber = @UnitNum;

    IF @UnitId IS NULL
    BEGIN
        INSERT INTO Units (BuildingId, UnitTypeId, UnitNumber, FloorNumber, GrossArea, NetArea, IsActive, CreatedAt)
        VALUES (@BuildingAId, @UnitTypeId, @UnitNum, @FloorNum, 110.0, 95.0, 1, GETUTCDATE());

        SET @UnitId = SCOPE_IDENTITY();
    END

    -- Seed Occupancies
    IF @OccCode <> 'VACANT'
    BEGIN
        SET @OccTypeId = CASE WHEN @OccCode = 'OCCUPIED_OWNER' THEN @OwnerOccupancyTypeId ELSE @TenantOccupancyTypeId END;

        -- Primary Resident
        IF @PEmail IS NOT NULL
        BEGIN
            SELECT @PrimaryUserId = Id FROM Users WHERE Email = @PEmail;

            IF @PrimaryUserId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM UnitOccupancies WHERE UnitId = @UnitId AND UserId = @PrimaryUserId AND IsActive = 1)
            BEGIN
                INSERT INTO UnitOccupancies (UserId, UnitId, OccupancyTypeId, StartDate, IsActive, IsPrimary, CreatedAt)
                VALUES (@PrimaryUserId, @UnitId, @OccTypeId, '2026-08-01', 1, 1, GETUTCDATE());
            END
        END

        -- Secondary Resident (Multi-occupant test case for 401)
        IF @SEmail IS NOT NULL
        BEGIN
            SELECT @SecondaryUserId = Id FROM Users WHERE Email = @SEmail;

            IF @SecondaryUserId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM UnitOccupancies WHERE UnitId = @UnitId AND UserId = @SecondaryUserId AND IsActive = 1)
            BEGIN
                INSERT INTO UnitOccupancies (UserId, UnitId, OccupancyTypeId, StartDate, IsActive, IsPrimary, CreatedAt)
                VALUES (@SecondaryUserId, @UnitId, @OccTypeId, '2026-08-01', 1, 0, GETUTCDATE());
            END
        END
    END

    -- Seed Charge
    IF @Debt > 0 AND NOT EXISTS (SELECT 1 FROM UnitCharges WHERE UnitId = @UnitId AND IsCancelled = 0)
    BEGIN
        SET @DueDate = CASE WHEN @IsOverdue = 1 THEN DATEADD(day, -15, GETUTCDATE()) ELSE DATEADD(day, 15, GETUTCDATE()) END;
        SELECT TOP 1 @CreatorUserId = Id FROM Users WHERE Email = @PEmail;
        IF @CreatorUserId IS NULL SELECT TOP 1 @CreatorUserId = Id FROM Users WHERE Id = 1;

        INSERT INTO UnitCharges (UnitId, CreatedByUserId, Title, Amount, DueDate, ChargeType, IsCancelled, CreatedAt)
        VALUES (@UnitId, @CreatorUserId, N'Demo Aidat / Borç Kaydı', @Debt, @DueDate, 'MANUAL', 0, GETUTCDATE());
    END

    -- Seed Maintenance Request
    IF @MPriority IS NOT NULL AND NOT EXISTS (SELECT 1 FROM MaintenanceRequests WHERE UnitId = @UnitId AND Status IN ('OPEN', 'IN_PROGRESS'))
    BEGIN
        SET @ReqNum = 'REQ-' + CONVERT(VARCHAR(8), GETUTCDATE(), 112) + '-D' + CAST(@UnitId AS VARCHAR);
        SELECT TOP 1 @ReqUserId = Id FROM Users WHERE Email = @PEmail;
        IF @ReqUserId IS NULL SELECT TOP 1 @ReqUserId = Id FROM Users WHERE Id = 1;

        INSERT INTO MaintenanceRequests (RequestNumber, PropertyId, BuildingId, UnitId, CreatedByUserId, Category, Title, Description, Priority, Status, CreatedAt)
        VALUES (@ReqNum, @PropertyId, @BuildingAId, @UnitId, @ReqUserId, @MCategory, @MTitle, N'Demo Kat Planı Görsel Test Kaydı', @MPriority, 'IN_PROGRESS', GETUTCDATE());
    END

    FETCH NEXT FROM demo_cursor INTO @UnitNum, @FloorNum, @OccCode, @PEmail, @SEmail, @Debt, @IsOverdue, @MPriority, @MCategory, @MTitle;
END;

CLOSE demo_cursor;
DEALLOCATE demo_cursor;

DROP TABLE #DemoUnits;

PRINT '[PASS] Floor Map Demo Dataset with Distinct Residents Seeded Successfully!';
