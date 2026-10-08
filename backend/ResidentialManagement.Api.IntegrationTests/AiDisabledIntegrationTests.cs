using System.Net;
using System.Net.Http.Json;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class AiDisabledIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Disabled_ai_keeps_core_api_available_and_returns_controlled_results()
    {
        using var admin = Fixture.CreateClient(Data.AdminUserId, AppRoles.Admin);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/properties")).StatusCode);

        using var resident = Fixture.CreateClient(Data.ResidentAUserId, AppRoles.Resident);
        var suggestion = await resident.PostAsJsonAsync("/api/ai/maintenance/suggest", new
        {
            title = "Mutfak musluğu akıyor",
            description = "Mutfak musluğundan sürekli olarak su sızıntısı oluyor."
        });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, suggestion.StatusCode);

        var from = DateTime.UtcNow.Date.AddDays(-2);
        var to = DateTime.UtcNow.Date.AddDays(2);
        var insightResponse = await admin.PostAsJsonAsync("/api/ai/analytics/insight", new
        {
            fromDate = from,
            toDate = to
        });
        insightResponse.EnsureSuccessStatusCode();
        var insight = await insightResponse.ReadJsonAsync<AnalyticsAiInsightDto>();
        Assert.False(insight.AiEnhanced);
        Assert.False(string.IsNullOrWhiteSpace(insight.Summary));
    }
}
