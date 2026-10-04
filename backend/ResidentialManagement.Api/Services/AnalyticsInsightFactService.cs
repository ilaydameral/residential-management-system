using System.Globalization;
using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public sealed class AnalyticsInsightFactService : IAnalyticsInsightFactService
{
    private static readonly CultureInfo TurkishCulture = CultureInfo.GetCultureInfo("tr-TR");

    public AnalyticsInsightFactSet Generate(
        FinanceAnalyticsDto finance,
        MaintenanceAnalyticsDto maintenance,
        FacilityAnalyticsDto facilities)
    {
        var facts = new List<VerifiedAnalyticsFact>
        {
            Current("F_ASSESSED", AnalyticsFactCategory.Finance,
                $"Seçilen dönemde toplam tahakkuk {Money(finance.TotalCharged)}'dir."),
            Current("F_COLLECTED", AnalyticsFactCategory.Finance,
                $"Seçilen dönemde tahsil edilen tutar {Money(finance.TotalCollected)}'dir.",
                importance: finance.TotalCollected > 0m ? AnalyticsFactImportance.Notable : AnalyticsFactImportance.Normal),
            Current("F_OUTSTANDING", AnalyticsFactCategory.Finance,
                $"Dönem sonu itibarıyla ödenmemiş borç {Money(finance.OutstandingAmount)}'dir.",
                importance: finance.OutstandingAmount > 0m ? AnalyticsFactImportance.Notable : AnalyticsFactImportance.Normal),
            Current("F_OVERDUE", AnalyticsFactCategory.Finance,
                $"Gecikmiş {finance.OverdueChargeCount} tahakkukun ödenmemiş tutarı {Money(finance.OverdueAmount)}'dir.",
                importance: finance.OverdueAmount > 0m ? AnalyticsFactImportance.Attention : AnalyticsFactImportance.Normal,
                attention: finance.OverdueAmount > 0m),
            Current("F_EXPENSES", AnalyticsFactCategory.Finance,
                $"Seçilen dönemde toplam gider {Money(finance.TotalExpenses)}'dir."),
            Current("F_NET_CASH", AnalyticsFactCategory.Finance,
                $"Seçilen dönemde net nakit hareketi {Money(finance.NetCashPosition)}'dir."),
            Current("M_TOTAL", AnalyticsFactCategory.Maintenance,
                $"Seçilen dönemde {Count(maintenance.TotalRequests)} bakım talebi oluşturulmuştur.",
                importance: maintenance.TotalRequests > 0 ? AnalyticsFactImportance.Notable : AnalyticsFactImportance.Normal),
            Current("M_OPEN", AnalyticsFactCategory.Maintenance,
                $"Seçilen dönemde oluşturulan taleplerin {Count(maintenance.OpenBacklog)} tanesi şu anda açıktır."),
            Current("M_IN_PROGRESS", AnalyticsFactCategory.Maintenance,
                $"Seçilen dönemde oluşturulan taleplerin {Count(maintenance.InProgress)} tanesi şu anda işlem halindedir."),
            Current("M_HIGH_EMERGENCY", AnalyticsFactCategory.Maintenance,
                $"Seçilen dönemde oluşturulan yüksek veya acil öncelikli bakım talebi sayısı {Count(maintenance.HighOrEmergency)} olarak hesaplanmıştır.",
                importance: maintenance.HighOrEmergency > 0 ? AnalyticsFactImportance.Attention : AnalyticsFactImportance.Normal,
                attention: maintenance.HighOrEmergency > 0),
            Current("R_TOTAL", AnalyticsFactCategory.Facilities,
                $"Seçilen dönemde toplam {Count(facilities.TotalReservations)} rezervasyon vardır.",
                importance: facilities.TotalReservations > 0 ? AnalyticsFactImportance.Notable : AnalyticsFactImportance.Normal),
            Current("R_APPROVED", AnalyticsFactCategory.Facilities,
                $"Seçilen dönemde {Count(facilities.ApprovedOrCompleted)} rezervasyon onaylanmış veya tamamlanmıştır."),
            Current("R_PENDING", AnalyticsFactCategory.Facilities,
                $"Seçilen dönemde {Count(facilities.Pending)} rezervasyon beklemektedir.",
                importance: facilities.Pending > 0 ? AnalyticsFactImportance.Attention : AnalyticsFactImportance.Normal,
                attention: facilities.Pending > 0),
            Current("R_BOOKED_HOURS", AnalyticsFactCategory.Facilities,
                $"Onaylanmış veya tamamlanmış rezervasyonların toplam süresi {Number(facilities.BookedHours)} saattir.")
        };

        if (maintenance.AverageResolutionHours.HasValue)
        {
            facts.Add(Current("M_AVG_RESOLUTION", AnalyticsFactCategory.Maintenance,
                $"Çözülmüş veya kapatılmış taleplerin ortalama çözüm süresi {Number(maintenance.AverageResolutionHours.Value)} saattir."));
        }

        if (finance.OutstandingAmount > finance.TotalCollected)
        {
            facts.Add(new VerifiedAnalyticsFact(
                "F_OUTSTANDING_GT_COLLECTION",
                AnalyticsFactCategory.Finance,
                AnalyticsFactKind.VerifiedRelationship,
                AnalyticsFactImportance.Attention,
                "Ödenmemiş borç tutarı, seçilen dönemde tahsil edilen tutardan yüksektir.",
                true,
                true,
                true));
        }

        AddComparison(facts, "F_ASSESSED_CHANGE", AnalyticsFactCategory.Finance,
            "Toplam tahakkuk", finance.TotalAssessedComparison);
        AddComparison(facts, "F_COLLECTED_CHANGE", AnalyticsFactCategory.Finance,
            "Toplam tahsilat", finance.TotalCollectedComparison);
        AddComparison(facts, "F_EXPENSES_CHANGE", AnalyticsFactCategory.Finance,
            "Toplam gider", finance.TotalExpensesComparison);
        AddComparison(facts, "M_TOTAL_CHANGE", AnalyticsFactCategory.Maintenance,
            "Bakım talebi sayısı", maintenance.TotalRequestsComparison);
        AddComparison(facts, "M_AVG_RESOLUTION_CHANGE", AnalyticsFactCategory.Maintenance,
            "Ortalama çözüm süresi", maintenance.AverageResolutionHoursComparison);
        AddComparison(facts, "R_TOTAL_CHANGE", AnalyticsFactCategory.Facilities,
            "Rezervasyon sayısı", facilities.TotalReservationsComparison);
        AddComparison(facts, "R_BOOKED_HOURS_CHANGE", AnalyticsFactCategory.Facilities,
            "Onaylanmış veya tamamlanmış rezervasyonların toplam süresi", facilities.BookedHoursComparison);

        var defaultSummaryIds = SelectDefaultSummary(facts);
        var defaultHighlightIds = facts
            .Where(fact => fact.IsHighlightCandidate)
            .OrderByDescending(fact => fact.Importance)
            .ThenBy(fact => fact.Id, StringComparer.Ordinal)
            .Take(3)
            .Select(fact => fact.Id)
            .ToList();

        return new AnalyticsInsightFactSet(facts, defaultSummaryIds, defaultHighlightIds);
    }

    private static VerifiedAnalyticsFact Current(
        string id,
        AnalyticsFactCategory category,
        string text,
        AnalyticsFactImportance importance = AnalyticsFactImportance.Normal,
        bool attention = false)
        => new(
            id,
            category,
            AnalyticsFactKind.CurrentValue,
            importance,
            text,
            true,
            true,
            attention);

    private static void AddComparison(
        ICollection<VerifiedAnalyticsFact> facts,
        string id,
        AnalyticsFactCategory category,
        string metricLabel,
        AnalyticsKpiComparisonDto comparison)
    {
        if (!comparison.CurrentValue.HasValue || !comparison.PreviousValue.HasValue)
        {
            return;
        }

        var current = comparison.CurrentValue.Value;
        var previous = comparison.PreviousValue.Value;
        var direction = current.CompareTo(previous) switch
        {
            > 0 when previous == 0m => "önceki eşit uzunluktaki dönemde sıfırken bu dönemde yeni bir değer oluşturmuştur",
            > 0 => "önceki eşit uzunluktaki döneme göre artmıştır",
            < 0 => "önceki eşit uzunluktaki döneme göre azalmıştır",
            _ => "önceki eşit uzunluktaki döneme göre değişmemiştir"
        };

        facts.Add(new VerifiedAnalyticsFact(
            id,
            category,
            AnalyticsFactKind.Comparison,
            current == previous ? AnalyticsFactImportance.Normal : AnalyticsFactImportance.Notable,
            $"{metricLabel} {direction}.",
            true,
            current != previous,
            false));
    }

    private static IReadOnlyList<string> SelectDefaultSummary(IReadOnlyCollection<VerifiedAnalyticsFact> facts)
    {
        var selected = new List<VerifiedAnalyticsFact>();
        foreach (var category in new[]
                 {
                     AnalyticsFactCategory.Finance,
                     AnalyticsFactCategory.Maintenance,
                     AnalyticsFactCategory.Facilities
                 })
        {
            var fact = facts
                .Where(item => item.Category == category && item.IsSummaryCandidate)
                .OrderByDescending(item => item.Importance)
                .ThenBy(item => item.Id, StringComparer.Ordinal)
                .FirstOrDefault();
            if (fact is not null)
            {
                selected.Add(fact);
            }
        }

        return selected.Take(3).Select(fact => fact.Id).ToList();
    }

    private static string Money(decimal value) => $"{Number(value)} TL";

    private static string Number(decimal value) => value.ToString("#,0.##", TurkishCulture);

    private static string Count(int value) => value.ToString("N0", TurkishCulture);
}
