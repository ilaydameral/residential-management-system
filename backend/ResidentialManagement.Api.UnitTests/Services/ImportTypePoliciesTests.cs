using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.UnitTests.Services;

public class ImportTypePoliciesTests
{
    [Theory]
    [InlineData("PROPERTIES", ImportTargetRequirement.None, false)]
    [InlineData("USERS", ImportTargetRequirement.None, false)]
    [InlineData("BUILDINGS", ImportTargetRequirement.Property, true)]
    [InlineData("UNITS", ImportTargetRequirement.Building, true)]
    [InlineData("OCCUPANCIES", ImportTargetRequirement.Building, true)]
    public void TryGet_SupportedType_ReturnsExpectedTargetAndManagerCandidate(
        string importType,
        ImportTargetRequirement expectedTarget,
        bool expectedManagerCandidate)
    {
        var found = ImportTypePolicies.TryGet(importType, out var policy);

        Assert.True(found);
        Assert.True(policy.IsEndToEndSupported);
        Assert.True(policy.IsAdminAllowed);
        Assert.Equal(expectedTarget, policy.TargetRequirement);
        Assert.Equal(expectedManagerCandidate, policy.IsManagerCandidate);
    }

    [Theory]
    [InlineData("DUE_CHARGES")]
    [InlineData("EXPENSES")]
    public void TryGet_KnownUnsupportedType_RemainsUnsupportedAndNotManagerCandidate(string importType)
    {
        Assert.True(ImportTypePolicies.TryGet(importType, out var policy));
        Assert.False(policy.IsEndToEndSupported);
        Assert.False(policy.IsManagerCandidate);
        Assert.Equal(ImportRollbackPolicy.NotSupported, policy.RollbackPolicy);
    }

    [Theory]
    [InlineData("")]
    [InlineData("UNKNOWN")]
    public void TryGet_UnknownOrEmptyType_ReturnsFalse(string importType)
    {
        Assert.False(ImportTypePolicies.TryGet(importType, out _));
    }

    [Fact]
    public void TryGet_TypeWithDifferentCase_UsesCanonicalPolicyWithoutEnablingManagerGlobally()
    {
        Assert.True(ImportTypePolicies.TryGet(" users ", out var policy));
        Assert.Equal("USERS", policy.ImportType);
        Assert.False(policy.IsManagerCandidate);
    }
}
