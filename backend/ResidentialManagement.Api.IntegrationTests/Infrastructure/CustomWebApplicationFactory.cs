using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ResidentialManagement.Api.Data;

namespace ResidentialManagement.Api.IntegrationTests.Infrastructure;

public sealed class CustomWebApplicationFactory(
    string connectionString,
    string contentRoot) : WebApplicationFactory<Program>
{
    internal const string JwtIssuer = "ResidentialManagementIntegrationTests";
    internal const string JwtAudience = "ResidentialManagementIntegrationTestClient";
    internal const string JwtKey = "IntegrationTestsOnly-SigningKey-DoNotUse-InProduction-2026";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseContentRoot(contentRoot);
        // Minimal hosting reads these values while Program is being evaluated, before
        // ConfigureAppConfiguration callbacks are applied to the built host.
        builder.UseSetting("ConnectionStrings:DefaultConnection", connectionString);
        builder.UseSetting("Jwt:Issuer", JwtIssuer);
        builder.UseSetting("Jwt:Audience", JwtAudience);
        builder.UseSetting("Jwt:Key", JwtKey);
        builder.UseSetting("Jwt:ExpirationMinutes", "30");
        builder.UseSetting("Ai:Provider", "Disabled");
        builder.UseSetting("Ai:Vision:Provider", "Disabled");
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = connectionString,
                ["Jwt:Issuer"] = JwtIssuer,
                ["Jwt:Audience"] = JwtAudience,
                ["Jwt:Key"] = JwtKey,
                ["Jwt:ExpirationMinutes"] = "30",
                ["Ai:Provider"] = "Disabled",
                ["Ai:Vision:Provider"] = "Disabled",
                ["Cors:AllowedOrigins:0"] = "http://integration.test"
            });
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<AppDbContext>();
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));
        });
    }
}
