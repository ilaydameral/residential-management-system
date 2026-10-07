using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.UnitTests.Services;

public class MaintenanceRequestRulesTests
{
    [Theory]
    [InlineData("LOW")]
    [InlineData("normal")]
    [InlineData(" HIGH ")]
    [InlineData("EMERGENCY")]
    public void IsAllowedPriority_KnownPriority_ReturnsTrue(string priority)
    {
        Assert.True(MaintenanceRequestRules.IsAllowedPriority(priority));
    }

    [Theory]
    [InlineData("")]
    [InlineData("CRITICAL")]
    public void IsAllowedPriority_UnknownPriority_ReturnsFalse(string priority)
    {
        Assert.False(MaintenanceRequestRules.IsAllowedPriority(priority));
    }

    [Fact]
    public void NormalizePriority_UnknownPriority_FallsBackToNormal()
    {
        Assert.Equal("NORMAL", MaintenanceRequestRules.NormalizePriority("CRITICAL"));
    }

    [Fact]
    public void NormalizeCategory_KnownCategory_NormalizesCaseAndWhitespace()
    {
        Assert.Equal("PLUMBING", MaintenanceRequestRules.NormalizeCategory(" plumbing "));
        Assert.Equal("OTHER", MaintenanceRequestRules.NormalizeCategory("unknown"));
    }

    [Theory]
    [InlineData("OPEN", "IN_PROGRESS", true)]
    [InlineData("IN_PROGRESS", "RESOLVED", true)]
    [InlineData("OPEN", "RESOLVED", false)]
    [InlineData("RESOLVED", "CLOSED", false)]
    [InlineData("RESOLVED", "IN_PROGRESS", false)]
    public void ValidateStatusTransition_AllowedTransition_DoesNotThrow(
        string current,
        string target,
        bool isTechnicalStaff)
    {
        MaintenanceRequestRules.ValidateStatusTransition(current, target, isTechnicalStaff);
    }

    [Fact]
    public void ValidateStatusTransition_TechnicalStaffUnsupportedTransition_ThrowsForbidden()
    {
        Assert.Throws<ForbiddenException>(() =>
            MaintenanceRequestRules.ValidateStatusTransition("OPEN", "RESOLVED", true));
    }

    [Theory]
    [InlineData("CANCELLED")]
    [InlineData("CLOSED")]
    public void ValidateStatusTransition_TerminalStatus_CannotBeChanged(string current)
    {
        Assert.Throws<BadRequestException>(() =>
            MaintenanceRequestRules.ValidateStatusTransition(current, "IN_PROGRESS", false));
    }
}
