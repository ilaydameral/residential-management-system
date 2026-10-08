using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.UnitTests.Services;

public class AnalyticsCalculationsTests
{
    private static readonly DateTime Today = new(2026, 10, 8);

    [Fact]
    public void ResolveRange_NoDates_UsesLastThirtyCalendarDays()
    {
        var range = AnalyticsCalculations.ResolveRange(null, null, Today);

        Assert.Equal(new DateTime(2026, 9, 9), range.From);
        Assert.Equal(Today, range.ToInclusive);
        Assert.Equal(new DateTime(2026, 10, 9), range.ToExclusive);
    }

    [Fact]
    public void ResolveRange_SameDay_UsesExclusiveNextDayBoundary()
    {
        var range = AnalyticsCalculations.ResolveRange(Today, Today, Today);

        Assert.Equal(Today, range.From);
        Assert.Equal(Today, range.ToInclusive);
        Assert.Equal(Today.AddDays(1), range.ToExclusive);
    }

    [Fact]
    public void ResolveRange_Exactly366InclusiveDays_IsAccepted()
    {
        var from = new DateTime(2025, 1, 1);
        var to = from.AddDays(365);

        var range = AnalyticsCalculations.ResolveRange(from, to, Today);

        Assert.Equal(366, (range.ToExclusive - range.From).Days);
    }

    [Fact]
    public void ResolveRange_367InclusiveDays_IsRejected()
    {
        var from = new DateTime(2025, 1, 1);

        Assert.Throws<BadRequestException>(() =>
            AnalyticsCalculations.ResolveRange(from, from.AddDays(366), Today));
    }

    [Fact]
    public void ResolveRange_FromAfterTo_IsRejected()
    {
        Assert.Throws<BadRequestException>(() =>
            AnalyticsCalculations.ResolveRange(Today, Today.AddDays(-1), Today));
    }

    [Fact]
    public void ResolvePreviousRange_CurrentRange_ProducesEqualLengthNonOverlappingPeriod()
    {
        var current = AnalyticsCalculations.ResolveRange(
            new DateTime(2026, 10, 1), new DateTime(2026, 10, 8), Today);

        var previous = AnalyticsCalculations.ResolvePreviousRange(current);

        Assert.Equal(new DateTime(2026, 9, 23), previous.From);
        Assert.Equal(new DateTime(2026, 9, 30), previous.ToInclusive);
        Assert.Equal(current.From, previous.ToExclusive);
        Assert.Equal(current.ToExclusive - current.From, previous.ToExclusive - previous.From);
    }

    [Theory]
    [InlineData(100, 25, 75)]
    [InlineData(100, -25, 100)]
    [InlineData(100, 150, 0)]
    [InlineData(0, 0, 0)]
    public void CalculateCollectionRate_EdgeCases_ClampsToValidPercentage(
        decimal charged,
        decimal outstanding,
        decimal expected)
    {
        Assert.Equal(expected, AnalyticsCalculations.CalculateCollectionRate(charged, outstanding));
    }

    [Fact]
    public void BuildComparison_ZeroAgainstZero_ReturnsZeroPercent()
    {
        var result = AnalyticsCalculations.BuildComparison(0m, 0m);

        Assert.Equal(0m, result.PercentageChange);
    }

    [Fact]
    public void BuildComparison_NewValueFromZero_LeavesPercentageUndefined()
    {
        var result = AnalyticsCalculations.BuildComparison(25m, 0m);

        Assert.Null(result.PercentageChange);
        Assert.Equal(25m, result.CurrentValue);
        Assert.Equal(0m, result.PreviousValue);
    }

    [Fact]
    public void ResolutionHoursFromMinutes_NegativeDuration_IsIgnored()
    {
        Assert.Null(AnalyticsCalculations.ResolutionHoursFromMinutes(-1));
        Assert.Null(AnalyticsCalculations.ResolutionHoursFromMinutes(null));
        Assert.Equal(1.5m, AnalyticsCalculations.ResolutionHoursFromMinutes(90));
    }
}
