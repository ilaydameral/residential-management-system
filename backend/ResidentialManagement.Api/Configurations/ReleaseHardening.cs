using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace ResidentialManagement.Api.Configurations;

public static class ReleaseHardening
{
    public const string AuthPolicy = "auth";
    public const string AiPolicy = "ai";
    public const string UploadPolicy = "upload";

    public static void AddReleaseRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, token) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry))
                    context.HttpContext.Response.Headers.RetryAfter = Math.Ceiling(retry.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture);
                await context.HttpContext.Response.WriteAsJsonAsync(new
                {
                    statusCode = 429,
                    message = "Çok fazla istek gönderdiniz. Lütfen kısa bir süre bekleyip tekrar deneyin."
                }, token);
            };
            // Per-process safeguards for synchronous work. Scale-out requires a shared gateway limit.
            AddPolicy(options, configuration, AuthPolicy, 10, 60, false);
            AddPolicy(options, configuration, AiPolicy, 6, 60, true);
            AddPolicy(options, configuration, UploadPolicy, 10, 60, true);
        });
    }

    private static void AddPolicy(RateLimiterOptions options, IConfiguration config, string name,
        int permits, int seconds, bool authenticated)
    {
        permits = Math.Clamp(config.GetValue<int?>($"RateLimiting:{name}:PermitLimit") ?? permits, 1, 1000);
        seconds = Math.Clamp(config.GetValue<int?>($"RateLimiting:{name}:WindowSeconds") ?? seconds, 1, 3600);
        options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(
            authenticated && context.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } userId
                ? $"user:{userId}"
                : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permits, Window = TimeSpan.FromSeconds(seconds),
                QueueLimit = 0, AutoReplenishment = true
            }));
    }
}
