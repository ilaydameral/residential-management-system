using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class FinanceSqlIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Finance_analytics_uses_sql_semantics_for_cancellation_overdue_and_outstanding_floor()
    {
        using var admin = Fixture.CreateClient(Data.AdminUserId, AppRoles.Admin);
        var from = Uri.EscapeDataString(DateTime.UtcNow.Date.AddDays(-2).ToString("O"));
        var to = Uri.EscapeDataString(DateTime.UtcNow.Date.AddDays(2).ToString("O"));

        var response = await admin.GetAsync($"/api/analytics/finance?fromDate={from}&toDate={to}");
        response.EnsureSuccessStatusCode();
        var result = await response.ReadJsonAsync<FinanceAnalyticsDto>();

        Assert.Equal(250m, result.TotalCharged);
        Assert.Equal(90m, result.TotalCollected);
        Assert.Equal(180m, result.OutstandingAmount);
        Assert.Equal(1, result.OverdueChargeCount);
        Assert.Equal(60m, result.OverdueAmount);
        // Collection rate uses charge-applied collection (overpayments are capped at
        // the charge amount), while TotalCollected reports actual non-cancelled cash.
        Assert.Equal(28m, result.CollectionRate);
    }
}
