using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

internal sealed record AnalyticsRange(DateTime From, DateTime ToInclusive, DateTime ToExclusive);

internal static class AnalyticsCalculations
{
    internal const int MaximumRangeDays = 366;

    internal static AnalyticsRange ResolveRange(
        DateTime? fromDate,
        DateTime? toDate,
        DateTime utcToday)
    {
        var today = utcToday.Date;
        var from = (fromDate ?? today.AddDays(-29)).Date;
        var to = (toDate ?? today).Date;

        if (from > to)
        {
            throw new BadRequestException("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
        }

        if ((to - from).TotalDays >= MaximumRangeDays)
        {
            throw new BadRequestException(
                $"Analytics tarih aralığı en fazla {MaximumRangeDays} gün olabilir.");
        }

        return new AnalyticsRange(from, to, to.AddDays(1));
    }

    internal static AnalyticsRange ResolvePreviousRange(AnalyticsRange currentRange)
    {
        var dayCount = (currentRange.ToExclusive - currentRange.From).Days;
        if (currentRange.From < DateTime.MinValue.AddDays(dayCount))
        {
            throw new BadRequestException("Seçilen tarih aralığı için önceki dönem hesaplanamıyor.");
        }

        var previousFrom = currentRange.From.AddDays(-dayCount);
        return new AnalyticsRange(previousFrom, currentRange.From.AddDays(-1), currentRange.From);
    }

    internal static AnalyticsKpiComparisonDto BuildComparison(
        decimal? currentValue,
        decimal? previousValue)
    {
        decimal? percentageChange = null;
        if (currentValue.HasValue && previousValue.HasValue)
        {
            if (previousValue.Value > 0m)
            {
                percentageChange = Math.Round(
                    (currentValue.Value - previousValue.Value) * 100m / previousValue.Value,
                    1);
            }
            else if (previousValue.Value == 0m && currentValue.Value == 0m)
            {
                percentageChange = 0m;
            }
        }

        return new AnalyticsKpiComparisonDto
        {
            CurrentValue = currentValue,
            PreviousValue = previousValue,
            PercentageChange = percentageChange
        };
    }

    internal static decimal CalculateCollectionRate(decimal totalCharged, decimal outstandingAmount)
    {
        if (totalCharged <= 0m)
        {
            return 0m;
        }

        var collectedAgainstSelectedCharges = totalCharged - outstandingAmount;
        return Math.Clamp(
            Math.Round(collectedAgainstSelectedCharges * 100m / totalCharged, 2),
            0m,
            100m);
    }

    internal static decimal? ResolutionHoursFromMinutes(double? minutes)
        => minutes is >= 0d ? (decimal)minutes.Value / 60m : null;
}
