using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/global-search")]
[Authorize(Roles = "ADMIN,MANAGER")]
public class GlobalSearchController : ControllerBase
{
    private readonly IGlobalSearchService _searchService;

    public GlobalSearchController(IGlobalSearchService searchService)
    {
        _searchService = searchService;
    }

    [HttpGet]
    public async Task<IActionResult> GlobalSearch([FromQuery] string? q, [FromQuery] int limit = 5)
    {
        var query = q?.Trim() ?? string.Empty;
        if (query.Length < 2)
        {
            return BadRequest(new { message = "Arama terimi en az 2 karakter olmalıdır." });
        }

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out int userId))
        {
            return Unauthorized();
        }

        bool isAdmin = User.IsInRole("ADMIN");
        var result = await _searchService.SearchAsync(query, limit, userId, isAdmin);
        return Ok(result);
    }
}
