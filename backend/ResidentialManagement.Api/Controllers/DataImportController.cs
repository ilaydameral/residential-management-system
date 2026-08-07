using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/imports")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class DataImportController : ControllerBase
{
    private readonly IDataImportService _importService;

    public DataImportController(IDataImportService importService)
    {
        _importService = importService;
    }

    [HttpPost("upload")]
    public async Task<ActionResult<ImportUploadResponseDto>> Upload(
        [FromForm] string importType,
        IFormFile file)
    {
        var result = await _importService.UploadFileAsync(file, importType, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpGet("{id:int}/columns")]
    public async Task<ActionResult<ImportColumnMappingOptionsDto>> GetColumnOptions(int id)
    {
        var result = await _importService.GetColumnMappingOptionsAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/validate")]
    public async Task<ActionResult<ImportPreviewResponseDto>> ValidateBatch(
        int id,
        [FromBody] ValidateImportBatchRequestDto request)
    {
        var result = await _importService.ValidateBatchAsync(id, request, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpGet("{id:int}/preview")]
    public async Task<ActionResult<ImportPreviewResponseDto>> GetPreview(
        int id,
        [FromQuery] string? action,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var result = await _importService.GetPreviewAsync(id, action, page, pageSize, GetCurrentUserId(), IsAdmin());
        return Ok(result);
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

    private bool IsAdmin() => User.IsInRole(AppRoles.Admin);
}
