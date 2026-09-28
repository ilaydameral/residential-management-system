using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/resident/documents")]
[Authorize(Roles = AppRoles.Resident)]
public class ResidentDocumentsController : ControllerBase
{
    private readonly IDocumentService _documentService;

    public ResidentDocumentsController(IDocumentService documentService) => _documentService = documentService;

    [HttpGet]
    public async Task<ActionResult<DocumentListResponseDto>> GetAll(
        [FromQuery] string? category, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _documentService.GetResidentAsync(category, search, page, pageSize, CurrentUserId()));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DocumentDto>> GetById(int id)
        => Ok(await _documentService.GetResidentByIdAsync(id, CurrentUserId()));

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var result = await _documentService.DownloadResidentAsync(id, CurrentUserId());
        return File(result.Stream, result.ContentType, result.FileName);
    }

    private int CurrentUserId()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
            throw new UnauthorizedException("Oturum kullanıcı bilgisi doğrulanamadı.");
        return id;
    }
}
