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

    [HttpGet]
    public async Task<ActionResult<ImportBatchListResponseDto>> GetBatches(
        [FromQuery] string? importType,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _importService.GetBatchesAsync(importType, status, page, pageSize, GetCurrentUserId(), IsAdmin());
        return Ok(result);
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

    [HttpPost("{id:int}/confirm")]
    public async Task<ActionResult<ImportConfirmResponseDto>> ConfirmBatch(int id)
    {
        var result = await _importService.ConfirmBatchAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpGet("{id:int}/summary")]
    public async Task<ActionResult<ImportSummaryResponseDto>> GetSummary(int id)
    {
        var result = await _importService.GetSummaryAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/rollback")]
    public async Task<ActionResult<ImportRollbackResponseDto>> RollbackBatch(int id)
    {
        var result = await _importService.RollbackBatchAsync(id, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpGet("{id:int}/export-errors")]
    public async Task<IActionResult> ExportErrors(int id)
    {
        var (fileBytes, contentType, fileName) = await _importService.ExportErrorsCsvAsync(id, GetCurrentUserId(), IsAdmin());
        return File(fileBytes, contentType, fileName);
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
