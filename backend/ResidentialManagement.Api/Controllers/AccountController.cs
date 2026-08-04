using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/account")]
[Authorize]
public class AccountController : ControllerBase
{
    private readonly IUserService _userService;

    public AccountController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet("me")]
    public async Task<ActionResult<AccountProfileDto>> GetCurrentProfile()
    {
        var userId = GetCurrentUserId();

        var profile = await _userService.GetCurrentProfileAsync(userId);
        if (profile is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = "Kullanıcı hesabı bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(profile);
    }

    [HttpPut("profile")]
    public async Task<ActionResult<AccountProfileDto>> UpdateCurrentProfile([FromBody] UpdateAccountProfileDto updateDto)
    {
        var profile = await _userService.UpdateCurrentProfileAsync(GetCurrentUserId(), updateDto);
        if (profile is null)
        {
            return NotFound(new ErrorResponse
            {
                StatusCode = 404,
                Message = "Kullanıcı hesabı bulunamadı.",
                Timestamp = DateTime.UtcNow
            });
        }

        return Ok(profile);
    }

    [HttpPut("password")]
    public async Task<IActionResult> ChangeCurrentPassword([FromBody] ChangeAccountPasswordDto changeDto)
    {
        await _userService.ChangeCurrentPasswordAsync(GetCurrentUserId(), changeDto);
        return NoContent();
    }

    private int GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdValue, out var userId))
        {
            throw new UnauthorizedException("Oturum kullanıcı bilgisi doğrulanamadı.");
        }

        return userId;
    }
}
