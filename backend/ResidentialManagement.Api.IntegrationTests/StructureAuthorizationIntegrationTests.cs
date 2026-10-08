using System.Net;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class StructureAuthorizationIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Building_level_manager_lists_and_details_are_scope_filtered()
    {
        using var admin = Fixture.CreateClient(Data.AdminUserId, AppRoles.Admin);
        var adminPropertiesResponse = await admin.GetAsync("/api/properties");
        adminPropertiesResponse.EnsureSuccessStatusCode();
        Assert.Equal(2, (await adminPropertiesResponse.ReadJsonAsync<List<PropertyDto>>()).Count);

        using var manager = Fixture.CreateClient(Data.ManagerUserId, AppRoles.Manager);
        var propertiesResponse = await manager.GetAsync("/api/properties");
        propertiesResponse.EnsureSuccessStatusCode();
        var properties = await propertiesResponse.ReadJsonAsync<List<PropertyDto>>();
        Assert.Collection(properties, property => Assert.Equal(Data.PropertyAId, property.Id));
        Assert.Equal(HttpStatusCode.Forbidden,
            (await manager.GetAsync($"/api/properties/{Data.PropertyBId}")).StatusCode);

        var buildingsResponse = await manager.GetAsync("/api/buildings");
        buildingsResponse.EnsureSuccessStatusCode();
        var buildings = await buildingsResponse.ReadJsonAsync<List<BuildingDto>>();
        Assert.Collection(buildings, building => Assert.Equal(Data.BuildingA1Id, building.Id));
        Assert.Equal(HttpStatusCode.OK,
            (await manager.GetAsync($"/api/buildings/{Data.BuildingA1Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await manager.GetAsync($"/api/buildings/{Data.BuildingA2Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await manager.GetAsync($"/api/buildings/{Data.BuildingB1Id}")).StatusCode);

        var unitsResponse = await manager.GetAsync("/api/units");
        unitsResponse.EnsureSuccessStatusCode();
        var units = await unitsResponse.ReadJsonAsync<List<UnitDto>>();
        Assert.Collection(units, unit => Assert.Equal(Data.UnitA1Id, unit.Id));
        Assert.Equal(HttpStatusCode.OK,
            (await manager.GetAsync($"/api/units/{Data.UnitA1Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await manager.GetAsync($"/api/units/{Data.UnitA2Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await manager.GetAsync($"/api/units/{Data.UnitB1Id}")).StatusCode);
    }

    [Fact]
    public async Task Resident_and_technical_roles_cannot_use_management_structure_endpoints()
    {
        using var resident = Fixture.CreateClient(Data.ResidentAUserId, AppRoles.Resident);
        using var technical = Fixture.CreateClient(Data.TechnicalUserId, AppRoles.TechnicalStaff);

        Assert.Equal(HttpStatusCode.Forbidden, (await resident.GetAsync("/api/properties")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await resident.GetAsync("/api/buildings")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await resident.GetAsync("/api/units")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await technical.GetAsync("/api/properties")).StatusCode);
    }
}
