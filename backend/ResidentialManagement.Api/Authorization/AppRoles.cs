namespace ResidentialManagement.Api.Authorization;

public static class AppRoles
{
    public const string Admin = "ADMIN";
    public const string Manager = "MANAGER";
    public const string Resident = "RESIDENT";
    public const string TechnicalStaff = "TECHNICAL_STAFF";

    public const string AdminOrManager = $"{Admin},{Manager}";
    public const string AnyRole = $"{Admin},{Manager},{Resident},{TechnicalStaff}";
}
