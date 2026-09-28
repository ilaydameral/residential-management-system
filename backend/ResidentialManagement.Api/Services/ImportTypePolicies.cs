namespace ResidentialManagement.Api.Services;

public enum ImportTargetRequirement
{
    None,
    Property,
    Building
}

public enum ImportRollbackPolicy
{
    NotSupported,
    DependencyCheckedDelete,
    SoftReversal
}

public sealed record ImportTypePolicy(
    string ImportType,
    bool IsEndToEndSupported,
    bool IsAdminAllowed,
    bool IsManagerCandidate,
    ImportTargetRequirement TargetRequirement,
    ImportRollbackPolicy RollbackPolicy,
    int? RowLimitOverride = null);

public static class ImportTypePolicies
{
    private static readonly IReadOnlyDictionary<string, ImportTypePolicy> Registry =
        new Dictionary<string, ImportTypePolicy>(StringComparer.OrdinalIgnoreCase)
        {
            ["PROPERTIES"] = new(
                "PROPERTIES", true, true, false,
                ImportTargetRequirement.None,
                ImportRollbackPolicy.DependencyCheckedDelete),
            ["BUILDINGS"] = new(
                "BUILDINGS", true, true, true,
                ImportTargetRequirement.Property,
                ImportRollbackPolicy.DependencyCheckedDelete),
            ["UNITS"] = new(
                "UNITS", true, true, true,
                ImportTargetRequirement.Building,
                ImportRollbackPolicy.DependencyCheckedDelete),
            ["USERS"] = new(
                "USERS", true, true, false,
                ImportTargetRequirement.None,
                ImportRollbackPolicy.DependencyCheckedDelete),
            ["OCCUPANCIES"] = new(
                "OCCUPANCIES", true, true, true,
                ImportTargetRequirement.Building,
                ImportRollbackPolicy.SoftReversal),
            ["DUE_CHARGES"] = new(
                "DUE_CHARGES", false, true, false,
                ImportTargetRequirement.None,
                ImportRollbackPolicy.NotSupported),
            ["EXPENSES"] = new(
                "EXPENSES", false, true, false,
                ImportTargetRequirement.None,
                ImportRollbackPolicy.NotSupported)
        };

    public static IEnumerable<ImportTypePolicy> All => Registry.Values;

    public static bool TryGet(string importType, out ImportTypePolicy policy)
    {
        if (string.IsNullOrWhiteSpace(importType))
        {
            policy = null!;
            return false;
        }

        return Registry.TryGetValue(importType.Trim(), out policy!);
    }
}

public static class ImportProcessingLimits
{
    // Imports run synchronously today; these conservative limits keep parsing and validation bounded.
    public const long MaxFileSizeBytes = 20L * 1024 * 1024;
    public const int MaxRows = 5_000;
    public const int MaxColumns = 100;
    public const int MaxCellLength = 4_000;
    public const long MaxXlsxExpandedBytes = 100L * 1024 * 1024;
    public const int MaxXlsxArchiveEntries = 2_000;
}
