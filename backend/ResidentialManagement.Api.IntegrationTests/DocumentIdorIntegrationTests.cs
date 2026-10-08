using System.Net;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class DocumentIdorIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Document_downloads_enforce_resident_and_manager_scope_without_idor()
    {
        using var resident = Fixture.CreateClient(Data.ResidentAUserId, AppRoles.Resident);
        Assert.Equal(HttpStatusCode.OK,
            (await resident.GetAsync($"/api/resident/documents/{Data.ResidentADocumentId}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await resident.GetAsync($"/api/resident/documents/{Data.ResidentBDocumentId}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await resident.GetAsync("/api/resident/documents/999999/download")).StatusCode);

        using var manager = Fixture.CreateClient(Data.ManagerUserId, AppRoles.Manager);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await manager.GetAsync($"/api/documents/{Data.ManagementDocumentId}/download")).StatusCode);

        using var technical = Fixture.CreateClient(Data.TechnicalUserId, AppRoles.TechnicalStaff);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await technical.GetAsync($"/api/documents/{Data.ManagementDocumentId}/download")).StatusCode);
    }
}
