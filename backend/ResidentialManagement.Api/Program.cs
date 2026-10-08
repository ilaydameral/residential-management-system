using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using ResidentialManagement.Api.Configurations;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Middleware;
using ResidentialManagement.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddReleaseRateLimiting(builder.Configuration);
builder.Services.AddHealthChecks().AddCheck<DatabaseReadinessCheck>("database", tags: ["ready"]);
builder.Services.Configure<AiOptions>(builder.Configuration.GetSection(AiOptions.SectionName));

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? ["http://localhost:5173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var connectionString =
    builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Connection string 'DefaultConnection' was not found."
    );

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString)
);

// Register Identity / Password Hasher
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// Register application services (Dependency Injection)
builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAdminInitializer, AdminInitializer>();

builder.Services.AddScoped<IPropertyTypeService, PropertyTypeService>();
builder.Services.AddScoped<IUnitTypeService, UnitTypeService>();
builder.Services.AddScoped<IPropertyService, PropertyService>();
builder.Services.AddScoped<IBuildingService, BuildingService>();
builder.Services.AddScoped<IUnitService, UnitService>();
builder.Services.AddScoped<IUnitOccupancyService, UnitOccupancyService>();
builder.Services.AddScoped<IOccupancyTypeService, OccupancyTypeService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IManagerAssignmentService, ManagerAssignmentService>();
builder.Services.AddScoped<IManagerScopeService, ManagerScopeService>();
builder.Services.AddScoped<IDueDefinitionService, DueDefinitionService>();
builder.Services.AddScoped<IDuePeriodService, DuePeriodService>();
builder.Services.AddScoped<IExpenseService, ExpenseService>();
builder.Services.AddScoped<IReceiptStorageService, LocalReceiptStorageService>();
builder.Services.AddScoped<IPaymentSubmissionService, PaymentSubmissionService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IFinancialReportingService, FinancialReportingService>();
builder.Services.AddScoped<IImportFileStorageService, ImportFileStorageService>();
builder.Services.AddScoped<IImportFileParser, ImportFileParser>();
builder.Services.AddScoped<IDataImportService, DataImportService>();
builder.Services.AddScoped<IAnnouncementService, AnnouncementService>();
builder.Services.AddScoped<IRequestFileStorageService, RequestFileStorageService>();
builder.Services.AddScoped<IMaintenanceRequestService, MaintenanceRequestService>();
builder.Services.AddScoped<IFacilityService, FacilityService>();
builder.Services.AddScoped<IVisitorService, VisitorService>();
builder.Services.AddScoped<IResidentVehicleService, ResidentVehicleService>();
builder.Services.AddScoped<IGlobalSearchService, GlobalSearchService>();
builder.Services.AddScoped<IDocumentFileStorageService, DocumentFileStorageService>();
builder.Services.AddScoped<IDocumentService, DocumentService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<IAnalyticsInsightFactService, AnalyticsInsightFactService>();
var aiProviderName = builder.Configuration[$"{AiOptions.SectionName}:Provider"];
if (string.Equals(aiProviderName, "Ollama", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddHttpClient<IAiProvider, OllamaAiProvider>(client =>
    {
        // AiAssistantService owns the bounded timeout and distinguishes it from caller cancellation.
        client.Timeout = Timeout.InfiniteTimeSpan;
    });
}
else
{
    builder.Services.AddSingleton<IAiProvider, UnavailableAiProvider>();
}
var aiVisionProviderName = builder.Configuration[$"{AiOptions.SectionName}:Vision:Provider"];
if (string.Equals(aiVisionProviderName, "Ollama", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddHttpClient<IAiVisionProvider, OllamaAiVisionProvider>(client =>
    {
        // MaintenanceVisionAnalysisService owns the bounded timeout.
        client.Timeout = Timeout.InfiniteTimeSpan;
    });
}
else
{
    builder.Services.AddSingleton<IAiVisionProvider, UnavailableAiVisionProvider>();
}
builder.Services.AddScoped<IAiAssistantService, AiAssistantService>();
builder.Services.AddSingleton<IMaintenanceImageValidator, MaintenanceImageValidator>();
builder.Services.AddScoped<IMaintenanceVisionAnalysisService, MaintenanceVisionAnalysisService>();
builder.Services.AddScoped<IRealtimePublisher, RealtimePublisher>();

builder.Services.AddSignalR();

// Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSettings["Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException("JWT Key configuration must be at least 256 bits (32 characters) long.");
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        var components = document.Components ??= new OpenApiComponents();
        components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "JWT Access Token Authentication"
        };
        return Task.CompletedTask;
    });
});

var app = builder.Build();

// Global Exception Handling Middleware
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("FrontendPolicy");

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseStatusCodePages(async context =>
{
    if (context.HttpContext.Response.StatusCode is 400 or 413)
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            statusCode = context.HttpContext.Response.StatusCode,
            message = "İstek okunamadı veya izin verilen boyutu aşıyor."
        });
});
app.Use(async (context, next) =>
{
    // Reject known oversized bodies before multipart model binding. Chunked bodies remain server-bounded.
    var limit = context.GetEndpoint()?.Metadata.GetMetadata<Microsoft.AspNetCore.Http.Metadata.IRequestSizeLimitMetadata>();
    if (limit?.MaxRequestBodySize is { } maximum && context.Request.ContentLength > maximum)
    {
        context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
        await context.Response.WriteAsJsonAsync(new { statusCode = 413, message = "Yüklenen dosya veya istek izin verilen boyutu aşıyor." });
        return;
    }
    await next(context);
});

// Probe bodies contain no dependency details. Optional AI is intentionally not a readiness dependency.
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = async (context, report) =>
        await context.Response.WriteAsJsonAsync(new { status = report.Status.ToString() })
}).AllowAnonymous();

app.MapControllers();
app.MapHub<ResidentialManagement.Api.Hubs.RealtimeHub>("/hubs/realtime");

// Execute Development Bootstrap Admin / Test Users Initializer
using (var scope = app.Services.CreateScope())
{
    var adminInitializer = scope.ServiceProvider.GetRequiredService<IAdminInitializer>();
    await adminInitializer.InitializeAsync();
}

app.Run();

public partial class Program;
