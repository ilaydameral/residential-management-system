using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/resident")]
[Authorize(Roles = AppRoles.Resident)]
public class ResidentFacilitiesController : ControllerBase
{
    private readonly IFacilityService _facilityService;

    public ResidentFacilitiesController(IFacilityService facilityService)
    {
        _facilityService = facilityService;
    }

    [HttpGet("facilities")]
    public async Task<ActionResult<List<CommonFacilityDto>>> GetFacilities()
    {
        var residentUserId = GetCurrentUserId();
        var facilities = await _facilityService.GetResidentFacilitiesAsync(residentUserId);
        return Ok(facilities);
    }

    [HttpGet("facilities/{facilityId}/availability")]
    public async Task<ActionResult<FacilityAvailabilityDto>> GetAvailability(int facilityId, [FromQuery] DateTime date)
    {
        var residentUserId = GetCurrentUserId();
        var availability = await _facilityService.GetFacilityAvailabilityAsync(facilityId, date, residentUserId);
        return Ok(availability);
    }

    [HttpPost("facility-reservations")]
    public async Task<ActionResult<FacilityReservationDto>> CreateReservation([FromBody] CreateReservationDto dto)
    {
        var residentUserId = GetCurrentUserId();
        var reservation = await _facilityService.CreateReservationAsync(dto, residentUserId);
        return Ok(reservation);
    }

    [HttpPut("facility-reservations/{id}/cancel")]
    public async Task<ActionResult<FacilityReservationDto>> CancelReservation(long id)
    {
        var residentUserId = GetCurrentUserId();
        var reservation = await _facilityService.CancelReservationAsync(id, residentUserId);
        return Ok(reservation);
    }

    [HttpGet("facility-reservations/my")]
    public async Task<ActionResult<List<FacilityReservationDto>>> GetMyReservations()
    {
        var residentUserId = GetCurrentUserId();
        var reservations = await _facilityService.GetMyReservationsAsync(residentUserId);
        return Ok(reservations);
    }

    private int GetCurrentUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(value, out var userId))
        {
            throw new UnauthorizedException("Oturum kullanıcı bilgisi doğrulanamadı.");
        }
        return userId;
    }
}
