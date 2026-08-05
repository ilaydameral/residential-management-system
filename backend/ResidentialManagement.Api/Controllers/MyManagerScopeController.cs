using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/manager-assignments/my-scope")]
[Authorize(Roles = AppRoles.Manager)]
public class MyManagerScopeController : ControllerBase
{
    private readonly IManagerAssignmentService _managerAssignmentService;

    public MyManagerScopeController(IManagerAssignmentService managerAssignmentService)
    {
        _managerAssignmentService = managerAssignmentService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ManagerAssignmentDto>>> GetMyScope()
    {
        if (User.IsInRole(AppRoles.Admin))
        {
            return Forbid();
        }

        return Ok(await _managerAssignmentService.GetAllAsync(
            GetCurrentUserId(),
            propertyId: null,
            buildingId: null,
            isActive: true));
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
