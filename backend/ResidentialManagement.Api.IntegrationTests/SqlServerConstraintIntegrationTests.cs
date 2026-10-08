using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class SqlServerConstraintIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Sql_server_enforces_filtered_unique_index_and_check_constraint()
    {
        await Fixture.WithDbContextAsync(async context =>
        {
            context.ManagerAssignments.Add(new ManagerAssignment
            {
                ManagerUserId = Data.ManagerUserId,
                PropertyId = Data.PropertyAId,
                BuildingId = Data.BuildingA1Id,
                AssignedAt = DateTime.UtcNow,
                AssignedByUserId = Data.AdminUserId,
                IsActive = true
            });
            await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        });

        await Fixture.WithDbContextAsync(async context =>
        {
            context.Buildings.Add(new Building
            {
                PropertyId = Data.PropertyAId,
                Name = "Invalid Floors",
                Code = "INVALID-FLOORS",
                FloorCount = 0,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        });
    }

    [Fact]
    public async Task Sql_server_rowversion_rejects_stale_import_batch_update()
    {
        await using var scopeA = Fixture.Factory.Services.CreateAsyncScope();
        await using var scopeB = Fixture.Factory.Services.CreateAsyncScope();
        var contextA = scopeA.ServiceProvider.GetRequiredService<AppDbContext>();
        var contextB = scopeB.ServiceProvider.GetRequiredService<AppDbContext>();

        var first = await contextA.ImportBatches.SingleAsync(batch => batch.Id == Data.ImportBatchId);
        var stale = await contextB.ImportBatches.SingleAsync(batch => batch.Id == Data.ImportBatchId);
        first.Status = "READY";
        await contextA.SaveChangesAsync();

        stale.Status = "FAILED";
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => contextB.SaveChangesAsync());
    }
}
