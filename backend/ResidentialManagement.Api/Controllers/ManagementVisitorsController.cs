using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/management/visitors")]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
public class ManagementVisitorsController : ControllerBase
{
    private readonly IVisitorService _visitorService;

    public ManagementVisitorsController(IVisitorService visitorService)
    {
        _visitorService = visitorService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedVisitorResultDto>> GetVisitors([FromQuery] VisitorFilterDto filter)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var result = await _visitorService.GetManagementVisitorsAsync(userId, isAdmin, filter);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<VisitorDto>> GetById(long id)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        var visitor = await _visitorService.GetManagementVisitorByIdAsync(userId, isAdmin, id);
        if (visitor == null) return NotFound("Ziyaretçi kaydı bulunamadı.");
        return Ok(visitor);
    }

    [HttpPost("{id}/check-in")]
    public async Task<ActionResult<VisitorDto>> CheckIn(long id)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        try
        {
            var result = await _visitorService.CheckInVisitorAsync(userId, isAdmin, id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{id}/check-out")]
    public async Task<ActionResult<VisitorDto>> CheckOut(long id)
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AppRoles.Admin);
        try
        {
            var result = await _visitorService.CheckOutVisitorAsync(userId, isAdmin, id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ex.Message);
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
