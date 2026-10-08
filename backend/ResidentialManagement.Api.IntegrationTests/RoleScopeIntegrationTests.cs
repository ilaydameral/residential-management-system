using System.Net;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class RoleScopeIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Resident_unit_lists_are_isolated_and_ended_occupancy_grants_no_access()
    {
        using var residentA = Fixture.CreateClient(Data.ResidentAUserId, AppRoles.Resident);
        using var residentB = Fixture.CreateClient(Data.ResidentBUserId, AppRoles.Resident);
        using var endedResident = Fixture.CreateClient(Data.EndedResidentUserId, AppRoles.Resident);

        var responseA = await residentA.GetAsync("/api/resident/my-units");
        responseA.EnsureSuccessStatusCode();
        Assert.Collection(await responseA.ReadJsonAsync<List<ResidentUnitDto>>(),
            unit => Assert.Equal(Data.UnitA1Id, unit.UnitId));

        var responseB = await residentB.GetAsync("/api/resident/my-units");
        responseB.EnsureSuccessStatusCode();
        Assert.Collection(await responseB.ReadJsonAsync<List<ResidentUnitDto>>(),
            unit => Assert.Equal(Data.UnitA2Id, unit.UnitId));

        var endedResponse = await endedResident.GetAsync("/api/resident/my-units");
        endedResponse.EnsureSuccessStatusCode();
        Assert.Empty(await endedResponse.ReadJsonAsync<List<ResidentUnitDto>>());

        Assert.Equal(HttpStatusCode.NotFound,
            (await residentA.GetAsync($"/api/resident/documents/{Data.ResidentBDocumentId}")).StatusCode);
    }

    [Fact]
    public async Task Technical_staff_sees_only_assigned_requests()
    {
        using var technical = Fixture.CreateClient(Data.TechnicalUserId, AppRoles.TechnicalStaff);

        var listResponse = await technical.GetAsync("/api/technical/maintenance-requests");
        listResponse.EnsureSuccessStatusCode();
        var list = await listResponse.ReadJsonAsync<MaintenanceRequestListResponseDto>();
        Assert.Collection(list.Items, item => Assert.Equal(Data.AssignedMaintenanceRequestId, item.Id));

        Assert.Equal(HttpStatusCode.OK,
            (await technical.GetAsync($"/api/technical/maintenance-requests/{Data.AssignedMaintenanceRequestId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await technical.GetAsync($"/api/technical/maintenance-requests/{Data.UnassignedMaintenanceRequestId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await technical.GetAsync("/api/documents")).StatusCode);
    }
}
