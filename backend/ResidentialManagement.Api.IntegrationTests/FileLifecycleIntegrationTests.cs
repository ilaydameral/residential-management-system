using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class FileLifecycleIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Theory]
    [InlineData("maintenance", "request_attachments")]
    [InlineData("document", "documents")]
    [InlineData("import", "imports")]
    [InlineData("receipt", "receipts")]
    public async Task Database_failure_after_file_save_removes_only_new_file(string kind, string directory)
    {
        await using var scope = Fixture.Factory.Services.CreateAsyncScope();
        var sp = scope.ServiceProvider;
        var existing = sp.GetRequiredService<AppDbContext>();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(existing.Database.GetDbConnection().ConnectionString)
            .AddInterceptors(new FailSaveInterceptor()).Options;
        await using var db = new AppDbContext(options);
        var path = Path.Combine(Fixture.ContentRoot, "App_Data", directory);
        var before = Directory.Exists(path) ? Directory.GetFiles(path).Order().ToArray() : [];
        using var stream = new MemoryStream(kind == "import" ? "Name\nExample\n"u8.ToArray() : "%PDF-test"u8.ToArray());
        Task operation;
        if (kind == "maintenance")
        {
            var service = ActivatorUtilities.CreateInstance<MaintenanceRequestService>(sp, db);
            operation = service.AddAttachmentAsync(Data.AssignedMaintenanceRequestId, stream, "test.pdf", "application/pdf", Data.AdminUserId, true);
        }
        else if (kind == "document")
        {
            var service = ActivatorUtilities.CreateInstance<DocumentService>(sp, db);
            operation = service.CreateAsync(new CreateDocumentRequestDto
            {
                PropertyId = Data.PropertyAId, Title = "Test document", Category = "OTHER", Visibility = "MANAGEMENT_ONLY",
                File = new FormFile(stream, 0, stream.Length, "file", "test.pdf") { Headers = new HeaderDictionary(), ContentType = "application/pdf" }
            }, Data.AdminUserId, true);
        }
        else if (kind == "import")
        {
            var service = ActivatorUtilities.CreateInstance<DataImportService>(sp, db);
            operation = service.UploadFileAsync(new FormFile(stream, 0, stream.Length, "file", "test.csv"), "PROPERTIES", null, null, Data.AdminUserId, true);
        }
        else
        {
            var charge = await db.UnitCharges.FirstAsync(c => c.UnitId == Data.UnitA1Id && !c.IsCancelled);
            var service = ActivatorUtilities.CreateInstance<PaymentSubmissionService>(sp, db);
            operation = service.CreateSubmissionAsync(new CreatePaymentSubmissionRequestDto
            {
                UnitChargeId = charge.Id, Amount = 1, PaymentDate = DateTime.UtcNow.Date,
                ReceiptFile = new FormFile(stream, 0, stream.Length, "file", "test.pdf") { Headers = new HeaderDictionary(), ContentType = "application/pdf" }
            }, Data.ResidentAUserId);
        }
        if (kind == "document") await Assert.ThrowsAsync<ConflictException>(() => operation);
        else await Assert.ThrowsAsync<DbUpdateException>(() => operation);
        Assert.Equal(before, Directory.GetFiles(path).Order().ToArray());
    }

    private sealed class FailSaveInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
            => throw new DbUpdateException("Intentional integration-test persistence failure");
    }

    [Fact]
    public async Task Persisted_receipt_survives_realtime_failure()
    {
        await using var scope = Fixture.Factory.Services.CreateAsyncScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<AppDbContext>();
        var charge = await db.UnitCharges.FirstAsync(c => c.UnitId == Data.UnitA1Id && !c.IsCancelled);
        var publisher = DispatchProxy.Create<IRealtimePublisher, FailingPublisher>();
        var service = ActivatorUtilities.CreateInstance<PaymentSubmissionService>(sp, publisher);
        using var stream = new MemoryStream("%PDF-test"u8.ToArray());
        await Assert.ThrowsAsync<IOException>(() => service.CreateSubmissionAsync(new CreatePaymentSubmissionRequestDto
        {
            UnitChargeId = charge.Id, Amount = 1, PaymentDate = DateTime.UtcNow.Date,
            ReceiptFile = new FormFile(stream, 0, stream.Length, "file", "receipt.pdf") { Headers = new HeaderDictionary(), ContentType = "application/pdf" }
        }, Data.ResidentAUserId));
        var row = await db.PaymentSubmissions.SingleAsync(s => s.SubmittedByUserId == Data.ResidentAUserId);
        Assert.True(File.Exists(Path.Combine(Fixture.ContentRoot, "App_Data", "receipts", row.ReceiptAttachmentUrl!)));
    }

    public class FailingPublisher : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => Task.FromException(new IOException("Intentional test realtime failure"));
    }
}
