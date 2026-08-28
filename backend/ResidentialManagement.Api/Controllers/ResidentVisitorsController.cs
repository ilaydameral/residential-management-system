using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/resident/visitors")]
[Authorize(Roles = AppRoles.Resident)]
public class ResidentVisitorsController : ControllerBase
{
    private readonly IVisitorService _visitorService;

    public ResidentVisitorsController(IVisitorService visitorService)
    {
        _visitorService = visitorService;
    }

    [HttpGet]
    public async Task<ActionResult<List<VisitorDto>>> GetMyVisitors(
        [FromQuery] string? status,
        [FromQuery] bool? upcomingOnly)
    {
        var residentUserId = GetCurrentUserId();
        var visitors = await _visitorService.GetResidentVisitorsAsync(residentUserId, status, upcomingOnly);
        return Ok(visitors);
    }

    [HttpGet("{id}", Name = "GetResidentVisitorById")]
    public async Task<ActionResult<VisitorDto>> GetById(long id)
    {
        var residentUserId = GetCurrentUserId();
        var visitor = await _visitorService.GetResidentVisitorByIdAsync(residentUserId, id);
        if (visitor == null) return NotFound("Ziyaretçi kaydı bulunamadı.");
        return Ok(visitor);
    }

    [HttpPost]
    public async Task<ActionResult<VisitorDto>> Create([FromBody] CreateVisitorDto dto)
    {
        var residentUserId = GetCurrentUserId();
        try
        {
            var visitor = await _visitorService.CreateVisitorAsync(residentUserId, dto);
            return CreatedAtRoute("GetResidentVisitorById", new { id = visitor.Id }, visitor);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id}/cancel")]
    [HttpPost("{id}/cancel")]
    public async Task<ActionResult<VisitorDto>> Cancel(long id)
    {
        var residentUserId = GetCurrentUserId();
        try
        {
            var result = await _visitorService.CancelVisitorAsync(residentUserId, id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private int GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(userIdStr, out var id) ? id : 0;
    }
}
