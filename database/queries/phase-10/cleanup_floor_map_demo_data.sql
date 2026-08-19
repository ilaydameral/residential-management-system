-- ============================================================================
-- PHASE 10: Building Floor Map Demo Dataset Cleanup Script
-- Purpose: Safely removes only the Phase 10 demo records ('Floor Map Demo Residence' & 'floor.demo.%@example.com').
-- ============================================================================

SET NOCOUNT ON;

DECLARE @PropertyId INT;
SELECT @PropertyId = Id FROM Properties WHERE Name = N'Floor Map Demo Residence';

IF @PropertyId IS NOT NULL
BEGIN
    -- Delete Maintenance Requests for demo property
    DELETE FROM MaintenanceRequests WHERE PropertyId = @PropertyId;

    -- Delete Payments & UnitCharges for units in demo property
    DELETE FROM Payments WHERE UnitChargeId IN (
        SELECT uc.Id FROM UnitCharges uc JOIN Units u ON uc.UnitId = u.Id JOIN Buildings b ON u.BuildingId = b.Id WHERE b.PropertyId = @PropertyId
    );
    DELETE FROM UnitCharges WHERE UnitId IN (
        SELECT u.Id FROM Units u JOIN Buildings b ON u.BuildingId = b.Id WHERE b.PropertyId = @PropertyId
    );

    -- Delete Unit Occupancies for units in demo property
    DELETE FROM UnitOccupancies WHERE UnitId IN (
        SELECT u.Id FROM Units u JOIN Buildings b ON u.BuildingId = b.Id WHERE b.PropertyId = @PropertyId
    );

    -- Delete Units
    DELETE FROM Units WHERE BuildingId IN (
        SELECT Id FROM Buildings WHERE PropertyId = @PropertyId
    );

    -- Delete Buildings
    DELETE FROM Buildings WHERE PropertyId = @PropertyId;

    -- Delete Property
    DELETE FROM Properties WHERE Id = @PropertyId;

    PRINT '[PASS] Floor Map Demo Property and associated records cleaned up successfully.';
END
ELSE
BEGIN
    PRINT '[INFO] Demo property Floor Map Demo Residence not found.';
END

-- Delete Demo Resident Users created for Floor Map testing
IF EXISTS (SELECT 1 FROM Users WHERE Email LIKE 'floor.demo.%@example.com')
BEGIN
    DELETE FROM UserRoles WHERE UserId IN (SELECT Id FROM Users WHERE Email LIKE 'floor.demo.%@example.com');
    DELETE FROM UnitOccupancies WHERE UserId IN (SELECT Id FROM Users WHERE Email LIKE 'floor.demo.%@example.com');
    DELETE FROM Users WHERE Email LIKE 'floor.demo.%@example.com';
    PRINT '[PASS] Floor Map Demo Resident Users cleaned up successfully.';
END
