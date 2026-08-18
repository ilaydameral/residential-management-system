using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
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

    [HttpGet]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<List<UserManagementDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] bool? isActive)
    {
        return Ok(await _userService.GetAllAsync(search, role, isActive));
    }

    [HttpGet("search")]
    public async Task<ActionResult<List<UserSearchResultDto>>> Search(
        [FromQuery] string? query,
        [FromQuery] string? role,
        [FromQuery] bool includeInactive = false)
    {
        var users = await _userService.SearchAsync(query, role, includeInactive);
        return Ok(users);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<UserDetailDto>> GetDetail(int id)
    {
        var user = await _userService.GetDetailAsync(id);
        return user is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(user);
    }

    [HttpPost]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<UserManagementDto>> Create(CreateManagedUserDto createDto)
    {
        var user = await _userService.CreateAsync(createDto);
        return Created($"/api/users/{user.Id}", user);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<UserManagementDto>> Update(int id, UpdateManagedUserDto updateDto)
    {
        var user = await _userService.UpdateAsync(id, updateDto);
        return user is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(user);
    }

    [HttpPatch("{id:int}/activate")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<UserManagementDto>> Activate(int id)
    {
        var user = await _userService.SetActiveAsync(id, true, GetCurrentUserId());
        return user is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(user);
    }

    [HttpPatch("{id:int}/deactivate")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<UserManagementDto>> Deactivate(int id)
    {
        var user = await _userService.SetActiveAsync(id, false, GetCurrentUserId());
        return user is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(user);
    }

    [HttpPut("{id:int}/roles")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<UserManagementDto>> UpdateRoles(int id, UpdateUserRolesDto updateDto)
    {
        var user = await _userService.UpdateRolesAsync(id, updateDto, GetCurrentUserId());
        return user is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(user);
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

    private static ErrorResponse CreateNotFoundResponse(int id)
    {
        return new ErrorResponse
        {
            StatusCode = 404,
            Message = $"ID'si {id} olan kullanıcı bulunamadı.",
            Timestamp = DateTime.UtcNow
        };
    }
}
