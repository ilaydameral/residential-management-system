using System.Net.Http.Headers;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ResidentialManagement.Api.Data;
using Testcontainers.MsSql;

namespace ResidentialManagement.Api.IntegrationTests.Infrastructure;

public sealed class IntegrationTestFixture : IAsyncLifetime
{
    private readonly MsSqlContainer _container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest")
        .WithPassword($"Integration-{Guid.NewGuid():N}-aA1!")
        .Build();
    private readonly SemaphoreSlim _resetLock = new(1, 1);

    public string ContentRoot { get; } = Path.Combine(
        Path.GetTempPath(), $"rms-integration-{Guid.NewGuid():N}");
    public CustomWebApplicationFactory Factory { get; private set; } = null!;
    public TestDataIds Data { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(ContentRoot);
        await _container.StartAsync();
        var connectionString = new SqlConnectionStringBuilder(_container.GetConnectionString())
        {
            InitialCatalog = "ResidentialManagementIntegrationTests"
        }.ConnectionString;
        Factory = new CustomWebApplicationFactory(connectionString, ContentRoot);

        await using var scope = Factory.Services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await context.Database.MigrateAsync();
    }

    public async Task ResetAndSeedAsync()
    {
        await _resetLock.WaitAsync();
        try
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await context.Database.EnsureDeletedAsync();
            await context.Database.MigrateAsync();

            var appData = Path.Combine(ContentRoot, "App_Data");
            if (Directory.Exists(appData))
            {
                Directory.Delete(appData, recursive: true);
            }

            Data = await TestDataSeeder.SeedAsync(context, ContentRoot);
        }
        finally
        {
            _resetLock.Release();
        }
    }

    public HttpClient CreateClient(int? userId = null, string? role = null, DateTime? expiresAt = null)
    {
        var client = Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
        if (userId.HasValue && role is not null)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
                "Bearer", TestJwtTokenFactory.Create(userId.Value, role, expiresAt));
        }

        return client;
    }

    public async Task<TResult> WithDbContextAsync<TResult>(Func<AppDbContext, Task<TResult>> action)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    public async Task WithDbContextAsync(Func<AppDbContext, Task> action)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    public async Task DisposeAsync()
    {
        if (Factory is not null)
        {
            await Factory.DisposeAsync();
        }

        await _container.DisposeAsync();
        if (Directory.Exists(ContentRoot))
        {
            Directory.Delete(ContentRoot, recursive: true);
        }

        _resetLock.Dispose();
    }
}
