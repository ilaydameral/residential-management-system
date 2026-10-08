using System.Net;
using System.Net.Http.Headers;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class AuthenticationIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Protected_endpoints_enforce_real_jwt_validation()
    {
        using var anonymous = Fixture.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/properties")).StatusCode);

        using var malformed = Fixture.CreateClient();
        malformed.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-jwt");
        Assert.Equal(HttpStatusCode.Unauthorized, (await malformed.GetAsync("/api/properties")).StatusCode);

        using var expired = Fixture.CreateClient(Data.AdminUserId, AppRoles.Admin, DateTime.UtcNow.AddMinutes(-5));
        Assert.Equal(HttpStatusCode.Unauthorized, (await expired.GetAsync("/api/properties")).StatusCode);

        using var admin = Fixture.CreateClient(Data.AdminUserId, AppRoles.Admin);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/properties")).StatusCode);

        using var resident = Fixture.CreateClient(Data.ResidentAUserId, AppRoles.Resident);
        Assert.Equal(HttpStatusCode.OK, (await resident.GetAsync("/api/resident/my-units")).StatusCode);
    }
}
