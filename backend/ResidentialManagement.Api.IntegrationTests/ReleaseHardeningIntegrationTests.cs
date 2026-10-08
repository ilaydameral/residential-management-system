using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class ReleaseHardeningIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Authentication_is_throttled_across_login_and_register_without_waiting()
    {
        await using var factory = Fixture.Factory.WithWebHostBuilder(builder =>
            builder.UseSetting("RateLimiting:auth:PermitLimit", "2"));
        using var client = factory.CreateClient();
        var invalid = new { userNameOrEmail = "missing@test.invalid", password = "invalid-password" };
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", invalid)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/register", new { })).StatusCode);
        client.DefaultRequestHeaders.Add("X-Forwarded-For", "203.0.113.99");
        var throttled = await client.PostAsJsonAsync("/api/auth/login", invalid);
        Assert.Equal(HttpStatusCode.TooManyRequests, throttled.StatusCode);
        Assert.NotNull(throttled.Headers.RetryAfter);
        Assert.Contains("Çok fazla istek", await throttled.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/auth/register", new { })).StatusCode);
    }

    [Fact]
    public async Task Normal_login_succeeds_below_limit()
    {
        const string password = "Integration-Login-Only-2026!";
        await using var scope = Fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.FindAsync(Data.ResidentAUserId);
        user!.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordService>().HashPassword(user, password);
        await db.SaveChangesAsync();
        await using var factory = Fixture.Factory.WithWebHostBuilder(builder => builder.UseSetting("RateLimiting:auth:PermitLimit", "2"));
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login", new { userNameOrEmail = user.UserName, password })).StatusCode);
    }

    [Fact]
    public async Task Ai_limit_is_per_user_shared_across_ai_actions_and_preserves_authorization()
    {
        await using var factory = Fixture.Factory.WithWebHostBuilder(builder => builder.UseSetting("RateLimiting:ai:PermitLimit", "1"));
        using var resident = factory.CreateClient();
        resident.DefaultRequestHeaders.Authorization = new("Bearer", TestJwtTokenFactory.Create(Data.ResidentAUserId, AppRoles.Resident));
        var input = new { title = "Musluk sızıntısı", description = "Mutfak musluğundan sürekli su sızıyor." };
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await resident.PostAsJsonAsync("/api/ai/maintenance/suggest", input)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await resident.PostAsJsonAsync("/api/ai/maintenance/improve-description", input)).StatusCode);
        using var other = factory.CreateClient();
        other.DefaultRequestHeaders.Authorization = new("Bearer", TestJwtTokenFactory.Create(Data.ResidentBUserId, AppRoles.Resident));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await other.PostAsJsonAsync("/api/ai/maintenance/suggest", input)).StatusCode);
        using var admin = factory.CreateClient();
        admin.DefaultRequestHeaders.Authorization = new("Bearer", TestJwtTokenFactory.Create(Data.AdminUserId, AppRoles.Admin));
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync("/api/ai/maintenance/suggest", input)).StatusCode);
    }

    [Fact]
    public async Task Upload_limit_does_not_throttle_lightweight_gets()
    {
        await using var factory = Fixture.Factory.WithWebHostBuilder(builder => builder.UseSetting("RateLimiting:upload:PermitLimit", "1"));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", TestJwtTokenFactory.Create(Data.AdminUserId, AppRoles.Admin));
        using var first = new MultipartFormDataContent();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/documents", first)).StatusCode);
        using var second = new MultipartFormDataContent();
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsync("/api/documents", second)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/documents")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/properties")).StatusCode);
    }

    [Fact]
    public async Task Health_probes_work_with_sql_available_and_ai_disabled()
    {
        using var client = Fixture.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        var ready = await client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
        Assert.Equal("{\"status\":\"Healthy\"}", await ready.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Unavailable_database_affects_only_readiness_and_leaks_no_details()
    {
        await using var factory = Fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddScoped(_ => new DatabaseReadinessCheck(new AppDbContext(
                new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(
                    "Server=127.0.0.1,1;Database=unavailable;User Id=probe;Password=test-only;Connect Timeout=1;TrustServerCertificate=True").Options)))));
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        var response = await client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("{\"status\":\"Unhealthy\"}", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("/api/imports/upload", "ADMIN", 22)]
    [InlineData("/api/documents", "ADMIN", 12)]
    [InlineData("/api/ai/maintenance/analyze-image", "RESIDENT", 7)]
    public async Task Known_oversized_multipart_is_rejected_with_safe_json(string url, string role, int megabytes)
    {
        using var client = Fixture.CreateClient(role == AppRoles.Admin ? Data.AdminUserId : Data.ResidentAUserId, role);
        using var content = new ByteArrayContent(new byte[megabytes * 1024 * 1024]);
        content.Headers.ContentType = new("multipart/form-data");
        var response = await client.PostAsync(url, content);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Contains("izin verilen boyutu", await response.Content.ReadAsStringAsync());
    }
}
