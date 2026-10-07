using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

internal static class MaintenanceRequestRules
{
    private static readonly HashSet<string> AllowedCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "PLUMBING", "ELECTRICAL", "HEATING_COOLING", "ELEVATOR",
        "CLEANING", "SECURITY", "STRUCTURAL", "OTHER"
    };

    private static readonly HashSet<string> AllowedPriorities = new(StringComparer.OrdinalIgnoreCase)
    {
        "LOW", "NORMAL", "HIGH", "EMERGENCY"
    };

    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"
    };

    internal static bool IsAllowedPriority(string? priority)
        => !string.IsNullOrWhiteSpace(priority) && AllowedPriorities.Contains(priority.Trim());

    internal static bool IsAllowedStatus(string status) => AllowedStatuses.Contains(status);

    internal static string NormalizeCategory(string? category)
    {
        if (string.IsNullOrWhiteSpace(category))
        {
            return "OTHER";
        }

        var normalized = category.Trim().ToUpperInvariant();
        return AllowedCategories.Contains(normalized) ? normalized : "OTHER";
    }

    internal static string NormalizePriority(string? priority)
    {
        if (string.IsNullOrWhiteSpace(priority))
        {
            return "NORMAL";
        }

        var normalized = priority.Trim().ToUpperInvariant();
        return AllowedPriorities.Contains(normalized) ? normalized : "NORMAL";
    }

    internal static void ValidateStatusTransition(
        string currentStatus,
        string targetStatus,
        bool isTechnicalStaff)
    {
        if (currentStatus is "CLOSED" or "CANCELLED")
        {
            throw new BadRequestException(
                $"Durumu '{currentStatus}' olan kapatılmış/iptal edilmiş talepler tekrar değiştirilemez.");
        }

        if (isTechnicalStaff)
        {
            if (currentStatus == "OPEN" && targetStatus == "IN_PROGRESS") return;
            if (currentStatus == "IN_PROGRESS" && targetStatus == "RESOLVED") return;
            throw new ForbiddenException(
                $"Teknik personel '{currentStatus}' -> '{targetStatus}' geçişini yapamaz.");
        }

        if (currentStatus == "OPEN" && targetStatus is "IN_PROGRESS" or "RESOLVED" or "CANCELLED")
        {
            return;
        }

        if (currentStatus == "IN_PROGRESS" && targetStatus is "RESOLVED" or "CANCELLED")
        {
            return;
        }

        if (currentStatus == "RESOLVED" && targetStatus is "CLOSED" or "IN_PROGRESS")
        {
            return;
        }

        throw new BadRequestException($"Geçersiz durum geçişi: '{currentStatus}' -> '{targetStatus}'.");
    }
}
