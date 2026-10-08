using System.Net;
using System.Net.Http.Json;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.IntegrationTests.Infrastructure;

namespace ResidentialManagement.Api.IntegrationTests;

public sealed class ReservationIntegrationTests(IntegrationTestFixture fixture) : IntegrationTestBase(fixture)
{
    [Fact]
    public async Task Reservation_overlap_boundary_and_maintenance_block_use_real_sql_transaction_rules()
    {
        using var resident = Fixture.CreateClient(Data.ResidentAUserId, AppRoles.Resident);
        var day = DateTime.UtcNow.Date.AddDays(9);

        var first = await PostReservation(resident, day.AddHours(9), day.AddHours(10));
        first.EnsureSuccessStatusCode();

        var overlap = await PostReservation(resident, day.AddHours(9).AddMinutes(30), day.AddHours(10).AddMinutes(30));
        Assert.Equal(HttpStatusCode.Conflict, overlap.StatusCode);

        var touchingBoundary = await PostReservation(resident, day.AddHours(10), day.AddHours(11));
        touchingBoundary.EnsureSuccessStatusCode();

        var blocked = await PostReservation(
            resident,
            Data.MaintenanceBlockStart,
            Data.MaintenanceBlockStart.AddHours(1));
        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
    }

    private Task<HttpResponseMessage> PostReservation(HttpClient client, DateTime start, DateTime end)
        => client.PostAsJsonAsync("/api/resident/facility-reservations", new CreateReservationDto
        {
            FacilityId = Data.FacilityId,
            UnitId = Data.UnitA1Id,
            StartTime = start,
            EndTime = end,
            Note = "Integration test"
        });
}
