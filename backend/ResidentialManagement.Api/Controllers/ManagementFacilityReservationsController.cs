using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/management/facility-reservations")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class ManagementFacilityReservationsController : ControllerBase
{
    private readonly IFacilityService _facilityService;

    public ManagementFacilityReservationsController(IFacilityService facilityService)
    {
        _facilityService = facilityService;
    }

    [HttpGet]
    public async Task<ActionResult<List<FacilityReservationDto>>> GetReservations(
        [FromQuery] int? facilityId,
        [FromQuery] int? propertyId,
        [FromQuery] int? buildingId,
        [FromQuery] string? status,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var reservations = await _facilityService.GetManagementReservationsAsync(
            userId, isAdmin, facilityId, propertyId, buildingId, status, dateFrom, dateTo);
        return Ok(reservations);
    }

    [HttpPost("{id}/approve")]
    public async Task<ActionResult<FacilityReservationDto>> Approve(long id)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var reservation = await _facilityService.ApproveReservationAsync(id, userId, isAdmin);
        return Ok(reservation);
    }

    [HttpPost("{id}/reject")]
    public async Task<ActionResult<FacilityReservationDto>> Reject(long id, [FromBody] ReviewReservationDto dto)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var reservation = await _facilityService.RejectReservationAsync(id, dto, userId, isAdmin);
        return Ok(reservation);
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
