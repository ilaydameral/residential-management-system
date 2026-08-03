using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet("search")]
    public async Task<ActionResult<List<UserSearchResultDto>>> Search(
        [FromQuery] string query,
        [FromQuery] bool includeInactive = false)
    {
        var users = await _userService.SearchAsync(query, includeInactive);
        return Ok(users);
    }
}
