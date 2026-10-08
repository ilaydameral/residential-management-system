using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.IntegrationTests.Infrastructure;

public sealed record TestDataIds(
    int AdminUserId,
    int ManagerUserId,
    int ResidentAUserId,
    int ResidentBUserId,
    int EndedResidentUserId,
    int TechnicalUserId,
    int PropertyAId,
    int PropertyBId,
    int BuildingA1Id,
    int BuildingA2Id,
    int BuildingB1Id,
    int UnitA1Id,
    int UnitA2Id,
    int UnitB1Id,
    int AssignedMaintenanceRequestId,
    int UnassignedMaintenanceRequestId,
    int FacilityId,
    DateTime MaintenanceBlockStart,
    int ResidentADocumentId,
    int ResidentBDocumentId,
    int ManagementDocumentId,
    int ImportBatchId);

internal static class TestDataSeeder
{
    internal static async Task<TestDataIds> SeedAsync(AppDbContext context, string contentRoot)
    {
        var now = DateTime.UtcNow;
        var roles = await context.Roles.ToDictionaryAsync(role => role.Code, StringComparer.Ordinal);

        var admin = User("admin-test", "admin@test.invalid", "Admin", "Test");
        var manager = User("manager-test", "manager@test.invalid", "Manager", "Test");
        var residentA = User("resident-a", "resident-a@test.invalid", "Resident", "A");
        var residentB = User("resident-b", "resident-b@test.invalid", "Resident", "B");
        var endedResident = User("resident-ended", "resident-ended@test.invalid", "Resident", "Ended");
        var technical = User("technical-test", "technical@test.invalid", "Technical", "Test");
        context.Users.AddRange(admin, manager, residentA, residentB, endedResident, technical);
        await context.SaveChangesAsync();

        context.UserRoles.AddRange(
            UserRole(admin, roles["ADMIN"], now),
            UserRole(manager, roles["MANAGER"], now),
            UserRole(residentA, roles["RESIDENT"], now),
            UserRole(residentB, roles["RESIDENT"], now),
            UserRole(endedResident, roles["RESIDENT"], now),
            UserRole(technical, roles["TECHNICAL_STAFF"], now));

        var propertyA = new Property
        {
            Name = "Property A", PropertyType = "RESIDENTIAL_COMPLEX", PropertyTypeId = 1,
            AddressLine = "A Street", City = "Istanbul", District = "Kadikoy", IsActive = true, CreatedAt = now
        };
        var propertyB = new Property
        {
            Name = "Property B", PropertyType = "RESIDENTIAL_COMPLEX", PropertyTypeId = 1,
            AddressLine = "B Street", City = "Istanbul", District = "Besiktas", IsActive = true, CreatedAt = now
        };
        context.Properties.AddRange(propertyA, propertyB);
        await context.SaveChangesAsync();

        var buildingA1 = Building(propertyA.Id, "Building A1", "A1", now);
        var buildingA2 = Building(propertyA.Id, "Building A2", "A2", now);
        var buildingB1 = Building(propertyB.Id, "Building B1", "B1", now);
        context.Buildings.AddRange(buildingA1, buildingA2, buildingB1);
        await context.SaveChangesAsync();

        var unitA1 = Unit(buildingA1.Id, "101", now);
        var unitA2 = Unit(buildingA2.Id, "201", now);
        var unitB1 = Unit(buildingB1.Id, "301", now);
        context.Units.AddRange(unitA1, unitA2, unitB1);
        await context.SaveChangesAsync();

        context.ManagerAssignments.Add(new ManagerAssignment
        {
            ManagerUserId = manager.Id,
            PropertyId = propertyA.Id,
            BuildingId = buildingA1.Id,
            AssignedAt = now.AddDays(-10),
            AssignedByUserId = admin.Id,
            IsActive = true
        });

        context.UnitOccupancies.AddRange(
            Occupancy(residentA.Id, unitA1.Id, now.AddMonths(-1), null, true, now),
            Occupancy(residentB.Id, unitA2.Id, now.AddMonths(-1), null, true, now),
            Occupancy(endedResident.Id, unitB1.Id, now.AddMonths(-2), now.AddDays(-1), false, now));

        var assignedRequest = Maintenance(
            "REQ-ASSIGNED", unitA1, propertyA.Id, residentA.Id, technical.Id, now);
        var unassignedRequest = Maintenance(
            "REQ-UNASSIGNED", unitA2, propertyA.Id, residentB.Id, null, now);
        context.MaintenanceRequests.AddRange(assignedRequest, unassignedRequest);

        var facility = new CommonFacility
        {
            PropertyId = propertyA.Id,
            BuildingId = buildingA1.Id,
            Name = "Test Meeting Room",
            Capacity = 10,
            OpeningTime = new TimeSpan(8, 0, 0),
            ClosingTime = new TimeSpan(22, 0, 0),
            SlotDurationMinutes = 60,
            RequiresManagerApproval = false,
            MaxActiveReservationsPerResident = 5,
            CancellationLeadTimeHours = 1,
            IsActive = true,
            CreatedAt = now
        };
        context.CommonFacilities.Add(facility);

        AddFinanceData(context, unitA1, admin, now);
        await context.SaveChangesAsync();

        var blockStart = now.Date.AddDays(10).AddHours(10);
        context.FacilityMaintenanceBlocks.Add(new FacilityMaintenanceBlock
        {
            FacilityId = facility.Id,
            StartTime = blockStart,
            EndTime = blockStart.AddHours(1),
            Reason = "Scheduled maintenance",
            CreatedByUserId = admin.Id,
            CreatedAt = now
        });

        var residentADocument = Document(
            propertyA.Id, buildingA1.Id, unitA1.Id, "resident-a.txt", DocumentVisibilities.Residents, admin.Id, now);
        var residentBDocument = Document(
            propertyA.Id, buildingA2.Id, unitA2.Id, "resident-b.txt", DocumentVisibilities.Residents, admin.Id, now);
        var managementDocument = Document(
            propertyB.Id, buildingB1.Id, unitB1.Id, "management-b.txt", DocumentVisibilities.ManagementOnly, admin.Id, now);
        context.Documents.AddRange(residentADocument, residentBDocument, managementDocument);

        var importBatch = new ImportBatch
        {
            ImportType = "UNITS",
            OriginalFileName = "units.csv",
            StorageKey = "integration-units.csv",
            FileHashSha256 = new string('a', 64),
            Status = "VALIDATED",
            TotalRows = 1,
            ValidRows = 1,
            CreatedByUserId = admin.Id,
            TargetPropertyId = propertyA.Id,
            TargetBuildingId = buildingA1.Id,
            CreatedAt = now,
            ValidatedAt = now
        };
        context.ImportBatches.Add(importBatch);
        await context.SaveChangesAsync();

        var documentsPath = Path.Combine(contentRoot, "App_Data", "documents");
        Directory.CreateDirectory(documentsPath);
        await File.WriteAllTextAsync(Path.Combine(documentsPath, residentADocument.StorageKey), "resident A document");
        await File.WriteAllTextAsync(Path.Combine(documentsPath, residentBDocument.StorageKey), "resident B document");
        await File.WriteAllTextAsync(Path.Combine(documentsPath, managementDocument.StorageKey), "management document");

        return new TestDataIds(
            admin.Id, manager.Id, residentA.Id, residentB.Id, endedResident.Id, technical.Id,
            propertyA.Id, propertyB.Id, buildingA1.Id, buildingA2.Id, buildingB1.Id,
            unitA1.Id, unitA2.Id, unitB1.Id,
            assignedRequest.Id, unassignedRequest.Id,
            facility.Id, blockStart,
            residentADocument.Id, residentBDocument.Id, managementDocument.Id,
            importBatch.Id);
    }

    private static User User(string userName, string email, string firstName, string lastName)
        => new()
        {
            UserName = userName,
            Email = email,
            PasswordHash = "not-a-real-hash",
            FirstName = firstName,
            LastName = lastName,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

    private static UserRole UserRole(User user, Role role, DateTime assignedAt)
        => new() { UserId = user.Id, RoleId = role.Id, AssignedAt = assignedAt };

    private static Building Building(int propertyId, string name, string code, DateTime now)
        => new()
        {
            PropertyId = propertyId, Name = name, Code = code,
            FloorCount = 5, IsActive = true, CreatedAt = now
        };

    private static Unit Unit(int buildingId, string number, DateTime now)
        => new()
        {
            BuildingId = buildingId, UnitTypeId = 1, UnitNumber = number,
            FloorNumber = 1, GrossArea = 100m, NetArea = 80m, IsActive = true, CreatedAt = now
        };

    private static UnitOccupancy Occupancy(
        int userId, int unitId, DateTime start, DateTime? end, bool active, DateTime now)
        => new()
        {
            UserId = userId, UnitId = unitId, OccupancyTypeId = 1,
            StartDate = start, EndDate = end, IsActive = active, IsPrimary = true, CreatedAt = now
        };

    private static MaintenanceRequest Maintenance(
        string number, Unit unit, int propertyId, int residentId, int? technicalId, DateTime now)
        => new()
        {
            RequestNumber = number,
            UnitId = unit.Id,
            PropertyId = propertyId,
            BuildingId = unit.BuildingId,
            CreatedByUserId = residentId,
            AssignedToUserId = technicalId,
            Category = "PLUMBING",
            Title = "Integration maintenance request",
            Description = "Integration test maintenance request description.",
            Priority = "NORMAL",
            Status = "OPEN",
            CreatedAt = now
        };

    private static Document Document(
        int propertyId, int buildingId, int unitId, string storageKey,
        string visibility, int adminId, DateTime now)
        => new()
        {
            PropertyId = propertyId,
            BuildingId = buildingId,
            UnitId = unitId,
            Title = storageKey,
            Category = DocumentCategories.General,
            OriginalFileName = storageKey,
            StorageKey = storageKey,
            ContentType = "text/plain",
            FileSize = 20,
            Sha256 = new string('b', 64),
            Visibility = visibility,
            IsActive = true,
            UploadedByUserId = adminId,
            UploadedAt = now
        };

    private static void AddFinanceData(AppDbContext context, Unit unit, User admin, DateTime now)
    {
        var overdue = Charge(unit, admin, 100m, now.Date.AddDays(-1), false, "Overdue", now);
        var dueToday = Charge(unit, admin, 50m, now.Date, false, "Due today", now);
        var future = Charge(unit, admin, 70m, now.Date.AddDays(1), false, "Future", now);
        var cancelled = Charge(unit, admin, 80m, now.Date.AddDays(-1), true, "Cancelled", now);
        var overpaid = Charge(unit, admin, 30m, now.Date.AddDays(-1), false, "Overpaid", now);
        context.UnitCharges.AddRange(overdue, dueToday, future, cancelled, overpaid);
        context.Payments.AddRange(
            Payment(overdue, admin, 40m, now, false),
            Payment(overdue, admin, 20m, now, true),
            Payment(overpaid, admin, 50m, now, false),
            Payment(cancelled, admin, 80m, now, false));
    }

    private static UnitCharge Charge(
        Unit unit, User admin, decimal amount, DateTime dueDate,
        bool cancelled, string title, DateTime now)
        => new()
        {
            Unit = unit,
            Title = title,
            Amount = amount,
            DueDate = dueDate,
            ChargeType = "MANUAL",
            IsCancelled = cancelled,
            CancelledAt = cancelled ? now : null,
            CancelledByUserId = cancelled ? admin.Id : null,
            CreatedAt = now,
            CreatedByUserId = admin.Id
        };

    private static Payment Payment(
        UnitCharge charge, User admin, decimal amount, DateTime date, bool cancelled)
        => new()
        {
            UnitCharge = charge,
            Amount = amount,
            PaymentDate = date,
            PaymentMethod = "BANK_TRANSFER",
            IsCancelled = cancelled,
            CancelledAt = cancelled ? date : null,
            CancelledByUserId = cancelled ? admin.Id : null,
            CreatedAt = date,
            CreatedByUserId = admin.Id
        };
}
