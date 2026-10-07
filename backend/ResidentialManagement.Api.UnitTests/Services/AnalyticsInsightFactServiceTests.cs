using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.UnitTests.Services;

public class AnalyticsInsightFactServiceTests
{
    private readonly AnalyticsInsightFactService _service = new();

    [Fact]
    public void Generate_OutstandingGreaterThanCollected_ProducesVerifiedAttentionFact()
    {
        var result = Generate(finance: Finance(outstanding: 16_599m, collected: 251m));

        var fact = Assert.Single(result.Facts, item => item.Id == "F_OUTSTANDING_GT_COLLECTION");
        Assert.True(fact.IsAttentionPoint);
        Assert.Contains("Ödenmemiş borç", fact.VerifiedText, StringComparison.Ordinal);
        Assert.DoesNotContain("ödenen borç", fact.VerifiedText, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Generate_ZeroOverdue_DoesNotMarkOverdueAsAttention()
    {
        var result = Generate(finance: Finance(overdue: 0m));

        var fact = Assert.Single(result.Facts, item => item.Id == "F_OVERDUE");
        Assert.False(fact.IsAttentionPoint);
    }

    [Fact]
    public void Generate_PendingReservations_ProducesAttentionFact()
    {
        var result = Generate(facilities: Facilities(pending: 3));

        Assert.True(Assert.Single(result.Facts, item => item.Id == "R_PENDING").IsAttentionPoint);
    }

    [Fact]
    public void Generate_HighOrEmergencyMaintenance_ProducesAttentionFact()
    {
        var result = Generate(maintenance: Maintenance(highOrEmergency: 2));

        Assert.True(Assert.Single(result.Facts, item => item.Id == "M_HIGH_EMERGENCY").IsAttentionPoint);
    }

    [Theory]
    [InlineData(20, 10, "artmıştır")]
    [InlineData(5, 10, "azalmıştır")]
    [InlineData(10, 10, "değişmemiştir")]
    [InlineData(5, 0, "yeni bir değer oluşturmuştur")]
    public void Generate_PreviousPeriodComparison_UsesExpectedSemanticDirection(
        decimal current,
        decimal previous,
        string expectedText)
    {
        var finance = Finance();
        finance.TotalAssessedComparison = new AnalyticsKpiComparisonDto
        {
            CurrentValue = current,
            PreviousValue = previous
        };

        var result = Generate(finance: finance);

        var fact = Assert.Single(result.Facts, item => item.Id == "F_ASSESSED_CHANGE");
        Assert.Contains(expectedText, fact.VerifiedText, StringComparison.Ordinal);
    }

    [Fact]
    public void Generate_SameInputs_ProducesDeterministicFallbackIds()
    {
        var finance = Finance(outstanding: 100m, collected: 20m, overdue: 30m);
        var maintenance = Maintenance(highOrEmergency: 1);
        var facilities = Facilities(pending: 2);

        var first = Generate(finance, maintenance, facilities);
        var second = Generate(finance, maintenance, facilities);

        Assert.Equal(first.DefaultSummaryFactIds, second.DefaultSummaryFactIds);
        Assert.Equal(first.DefaultHighlightFactIds, second.DefaultHighlightFactIds);
        Assert.Equal(
            new[] { "F_OUTSTANDING_GT_COLLECTION", "F_OVERDUE", "M_HIGH_EMERGENCY" },
            first.DefaultHighlightFactIds);
    }

    [Fact]
    public void Generate_OutstandingFact_PreservesTrustedMetricWording()
    {
        var result = Generate(finance: Finance(outstanding: 1_250m));

        var fact = Assert.Single(result.Facts, item => item.Id == "F_OUTSTANDING");
        Assert.Contains("ödenmemiş borç", fact.VerifiedText, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ödenen borç", fact.VerifiedText, StringComparison.OrdinalIgnoreCase);
    }

    private AnalyticsInsightFactSet Generate(
        FinanceAnalyticsDto? finance = null,
        MaintenanceAnalyticsDto? maintenance = null,
        FacilityAnalyticsDto? facilities = null)
        => _service.Generate(finance ?? Finance(), maintenance ?? Maintenance(), facilities ?? Facilities());

    private static FinanceAnalyticsDto Finance(
        decimal outstanding = 0m,
        decimal collected = 0m,
        decimal overdue = 0m)
        => new()
        {
            TotalCharged = outstanding + collected,
            TotalCollected = collected,
            OutstandingAmount = outstanding,
            OverdueAmount = overdue,
            OverdueChargeCount = overdue > 0m ? 1 : 0
        };

    private static MaintenanceAnalyticsDto Maintenance(int highOrEmergency = 0)
        => new() { TotalRequests = highOrEmergency, HighOrEmergency = highOrEmergency };

    private static FacilityAnalyticsDto Facilities(int pending = 0)
        => new() { TotalReservations = pending, Pending = pending };
}
