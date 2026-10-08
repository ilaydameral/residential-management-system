using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class ImportIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Upload_rejects_unsupported_types_wrong_targets_and_manager_access()
    {
        using var admin = Fixture.CreateClient(Data.AdminUserId, AppRoles.Admin);
        using var manager = Fixture.CreateClient(Data.ManagerUserId, AppRoles.Manager);

        Assert.Equal(HttpStatusCode.Forbidden, (await manager.GetAsync("/api/imports")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await UploadCsv(admin, "DUE_CHARGES", null, null)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await UploadCsv(admin, "UNITS", Data.PropertyAId, Data.BuildingB1Id)).StatusCode);
    }

    [Fact]
    public async Task Failed_confirm_rolls_back_all_rows_and_marks_batch_failed()
    {
        var batchId = await Fixture.WithDbContextAsync(async context =>
        {
            var batch = new ImportBatch
            {
                ImportType = "BUILDINGS",
                OriginalFileName = "rollback.csv",
                StorageKey = "rollback.csv",
                FileHashSha256 = new string('c', 64),
                Status = "READY",
                TotalRows = 2,
                ValidRows = 2,
                CreatedByUserId = Data.AdminUserId,
                TargetPropertyId = Data.PropertyAId,
                CreatedAt = DateTime.UtcNow,
                ValidatedAt = DateTime.UtcNow
            };
            batch.RowLogs.Add(Row(2, new() { ["Name"] = "Temporary Building", ["Code"] = "TEMP", ["FloorCount"] = "3" }));
            batch.RowLogs.Add(Row(3, new() { ["Name"] = "Duplicate Building", ["Code"] = "A1", ["FloorCount"] = "3" }));
            context.ImportBatches.Add(batch);
            await context.SaveChangesAsync();
            return batch.Id;
        });

        using var admin = Fixture.CreateClient(Data.AdminUserId, AppRoles.Admin);
        var response = await admin.PostAsync($"/api/imports/{batchId}/confirm", null);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        await Fixture.WithDbContextAsync(async context =>
        {
            Assert.False(await context.Buildings.AnyAsync(building => building.Code == "TEMP"));
            var batch = await context.ImportBatches.AsNoTracking().SingleAsync(item => item.Id == batchId);
            Assert.Equal("FAILED", batch.Status);
            Assert.Equal(0, batch.ImportedRows);
        });
    }

    private static ImportRowLog Row(int rowNumber, Dictionary<string, string> values)
        => new()
        {
            RowNumber = rowNumber,
            RawDataJson = JsonSerializer.Serialize(values),
            Status = "VALID",
            ActionPreview = "CREATE"
        };

    private static Task<HttpResponseMessage> UploadCsv(
        HttpClient client, string importType, int? propertyId, int? buildingId)
    {
        var form = new MultipartFormDataContent();
        form.Add(new StringContent(importType), "ImportType");
        if (propertyId.HasValue) form.Add(new StringContent(propertyId.Value.ToString()), "TargetPropertyId");
        if (buildingId.HasValue) form.Add(new StringContent(buildingId.Value.ToString()), "TargetBuildingId");
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes("UnitNumber,UnitTypeCode\n999,APARTMENT"));
        file.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        form.Add(file, "File", "small.csv");
        return client.PostAsync("/api/imports/upload", form);
    }
}
