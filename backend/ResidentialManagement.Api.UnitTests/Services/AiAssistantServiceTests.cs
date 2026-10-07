using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ResidentialManagement.Api.Configurations;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.UnitTests.Services;

public class AiAssistantServiceTests
{
    [Fact]
    public async Task SuggestMaintenanceAsync_AllowedStructuredOutput_ReturnsSuggestion()
    {
        var provider = new StubProvider(
            """{"suggestedCategory":"PLUMBING","suggestedPriority":"HIGH","confidence":0.8,"explanation":"Su sızıntısı.","warnings":[]}""");
        var service = CreateService(provider);

        var result = await service.SuggestMaintenanceAsync(new MaintenanceAiSuggestionRequestDto
        {
            Title = "Musluk sızıntısı",
            Description = "Musluktan sürekli su damlıyor."
        }, CancellationToken.None);

        Assert.Equal("PLUMBING", result.SuggestedCategory);
        Assert.Equal("HIGH", result.SuggestedPriority);
        Assert.Equal(0.8m, result.Confidence);
        Assert.Equal("maintenance-suggestion", provider.LastRequest?.UseCase);
        Assert.True(provider.LastRequest?.ResponseSchema.HasValue);
    }

    [Theory]
    [InlineData("INVALID", "HIGH", 0.8)]
    [InlineData("PLUMBING", "CRITICAL", 0.8)]
    [InlineData("PLUMBING", "HIGH", 1.1)]
    public async Task SuggestMaintenanceAsync_InvalidAllowlistOrConfidence_IsRejected(
        string category,
        string priority,
        decimal confidence)
    {
        var json = $$"""{"suggestedCategory":"{{category}}","suggestedPriority":"{{priority}}","confidence":{{confidence.ToString(System.Globalization.CultureInfo.InvariantCulture)}},"explanation":"Açıklama","warnings":[]}""";
        var service = CreateService(new StubProvider(json));

        await Assert.ThrowsAsync<AiInvalidResponseException>(() =>
            service.SuggestMaintenanceAsync(new MaintenanceAiSuggestionRequestDto
            {
                Title = "Bakım talebi",
                Description = "Yeterince uzun bakım açıklaması."
            }, CancellationToken.None));
    }

    [Fact]
    public async Task ImproveAnnouncementTextAsync_UnknownMode_IsRejectedBeforeProviderCall()
    {
        var provider = new StubProvider("{}");
        var service = CreateService(provider);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            service.ImproveAnnouncementTextAsync(new AnnouncementTextImprovementRequestDto
            {
                Text = "Yarın toplantı yapılacaktır.",
                Mode = "UNKNOWN"
            }, CancellationToken.None));
        Assert.Null(provider.LastRequest);
    }

    [Fact]
    public async Task ImproveAnnouncementTextAsync_ChangedDateOrNumber_IsRejected()
    {
        var provider = new StubProvider(
            """{"improvedText":"Toplantı 6 Ekim saat 11:00'da yapılacaktır."}""");
        var service = CreateService(provider);

        await Assert.ThrowsAsync<AiInvalidResponseException>(() =>
            service.ImproveAnnouncementTextAsync(new AnnouncementTextImprovementRequestDto
            {
                Text = "Toplantı 5 Ekim saat 10:00'da yapılacaktır.",
                Mode = "CLEARER"
            }, CancellationToken.None));
    }

    [Fact]
    public async Task GenerateAnalyticsInsightAsync_UnknownFactIds_UsesTrustedDeterministicFallback()
    {
        var provider = new StubProvider(
            """{"summaryFactIds":["UNKNOWN"],"highlightFactIds":["UNKNOWN"]}""");
        var facts = new AnalyticsInsightFactSet(
            [
                new VerifiedAnalyticsFact(
                    "F_OUTSTANDING",
                    AnalyticsFactCategory.Finance,
                    AnalyticsFactKind.CurrentValue,
                    AnalyticsFactImportance.Attention,
                    "Ödenmemiş borç 1.000 TL'dir.",
                    true,
                    true,
                    true)
            ],
            ["F_OUTSTANDING"],
            ["F_OUTSTANDING"]);
        var service = CreateService(
            provider,
            new StubAnalyticsService(),
            new StubFactService(facts));

        var result = await service.GenerateAnalyticsInsightAsync(
            1,
            true,
            new AnalyticsAiInsightRequestDto
            {
                FromDate = new DateTime(2026, 10, 1),
                ToDate = new DateTime(2026, 10, 8)
            },
            CancellationToken.None);

        Assert.False(result.AiEnhanced);
        Assert.Equal("Ödenmemiş borç 1.000 TL'dir.", result.Summary);
        Assert.Equal(["Ödenmemiş borç 1.000 TL'dir."], result.Highlights);
    }

    private static AiAssistantService CreateService(
        IAiProvider provider,
        IAnalyticsService? analyticsService = null,
        IAnalyticsInsightFactService? factService = null)
        => new(
            provider,
            analyticsService ?? new StubAnalyticsService(),
            factService ?? new StubFactService(new AnalyticsInsightFactSet([], [], [])),
            Options.Create(new AiOptions { TimeoutSeconds = 5 }),
            NullLogger<AiAssistantService>.Instance);

    private sealed class StubProvider(string content) : IAiProvider
    {
        public bool IsAvailable => true;
        public AiProviderRequest? LastRequest { get; private set; }

        public Task<AiProviderResponse> GenerateAsync(
            AiProviderRequest request,
            CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(new AiProviderResponse(content));
        }
    }

    private sealed class StubAnalyticsService : IAnalyticsService
    {
        public Task<FinanceAnalyticsDto> GetFinanceAsync(
            int userId, bool isAdmin, int? propertyId, int? buildingId, DateTime? fromDate, DateTime? toDate)
            => Task.FromResult(new FinanceAnalyticsDto());

        public Task<MaintenanceAnalyticsDto> GetMaintenanceAsync(
            int userId, bool isAdmin, int? propertyId, int? buildingId, DateTime? fromDate, DateTime? toDate)
            => Task.FromResult(new MaintenanceAnalyticsDto());

        public Task<FacilityAnalyticsDto> GetFacilitiesAsync(
            int userId, bool isAdmin, int? propertyId, int? buildingId, DateTime? fromDate, DateTime? toDate)
            => Task.FromResult(new FacilityAnalyticsDto());
    }

    private sealed class StubFactService(AnalyticsInsightFactSet facts) : IAnalyticsInsightFactService
    {
        public AnalyticsInsightFactSet Generate(
            FinanceAnalyticsDto finance,
            MaintenanceAnalyticsDto maintenance,
            FacilityAnalyticsDto facilities)
            => facts;
    }
}
