using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IAnalyticsInsightFactService
{
    AnalyticsInsightFactSet Generate(
        FinanceAnalyticsDto finance,
        MaintenanceAnalyticsDto maintenance,
        FacilityAnalyticsDto facilities);
}

public sealed record VerifiedAnalyticsFact(
    string Id,
    AnalyticsFactCategory Category,
    AnalyticsFactKind Kind,
    AnalyticsFactImportance Importance,
    string VerifiedText,
    bool IsSummaryCandidate,
    bool IsHighlightCandidate,
    bool IsAttentionPoint);

public sealed record AnalyticsInsightFactSet(
    IReadOnlyList<VerifiedAnalyticsFact> Facts,
    IReadOnlyList<string> DefaultSummaryFactIds,
    IReadOnlyList<string> DefaultHighlightFactIds);

public enum AnalyticsFactCategory
{
    Finance,
    Maintenance,
    Facilities
}

public enum AnalyticsFactKind
{
    CurrentValue,
    Comparison,
    VerifiedRelationship
}

public enum AnalyticsFactImportance
{
    Normal,
    Notable,
    Attention
}
