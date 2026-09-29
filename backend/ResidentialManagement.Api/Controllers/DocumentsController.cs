using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class DocumentsController : ControllerBase
{
    private readonly IDocumentService _documentService;

    public DocumentsController(IDocumentService documentService) => _documentService = documentService;

    [HttpGet]
    public async Task<ActionResult<DocumentListResponseDto>> GetAll(
        [FromQuery] int? propertyId, [FromQuery] int? buildingId, [FromQuery] int? unitId,
        [FromQuery] string? category, [FromQuery] string? visibility, [FromQuery] bool? isActive,
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _documentService.GetManagementAsync(propertyId, buildingId, unitId, category,
            visibility, isActive, search, page, pageSize, CurrentUserId(), IsAdmin()));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DocumentDto>> GetById(int id)
        => Ok(await _documentService.GetManagementByIdAsync(id, CurrentUserId(), IsAdmin()));

    [HttpPost]
    // Leave room for multipart headers while the storage service enforces the exact 10 MB file limit.
    [RequestSizeLimit(DocumentFileStorageService.MaxFileSizeBytes + 1024 * 1024)]
    public async Task<ActionResult<DocumentDto>> Create([FromForm] CreateDocumentRequestDto request)
    {
        var result = await _documentService.CreateAsync(request, CurrentUserId(), IsAdmin());
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<DocumentDto>> Update(int id, [FromBody] UpdateDocumentMetadataDto request)
        => Ok(await _documentService.UpdateMetadataAsync(id, request, CurrentUserId(), IsAdmin()));

    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<DocumentDto>> SetStatus(int id, [FromBody] UpdateDocumentStatusDto request)
        => Ok(await _documentService.SetStatusAsync(id, request.IsActive, CurrentUserId(), IsAdmin()));

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var result = await _documentService.DownloadManagementAsync(id, CurrentUserId(), IsAdmin());
        return File(result.Stream, result.ContentType, result.FileName);
    }

    private bool IsAdmin() => User.IsInRole(AppRoles.Admin);
    private int CurrentUserId()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
            throw new UnauthorizedException("Oturum kullanıcı bilgisi doğrulanamadı.");
        return id;
    }
}
