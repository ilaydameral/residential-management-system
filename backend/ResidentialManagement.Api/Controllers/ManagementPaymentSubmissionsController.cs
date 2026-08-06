using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/management/payment-submissions")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class ManagementPaymentSubmissionsController : ControllerBase
{
    private readonly IPaymentSubmissionService _paymentSubmissionService;

    public ManagementPaymentSubmissionsController(IPaymentSubmissionService paymentSubmissionService)
    {
        _paymentSubmissionService = paymentSubmissionService;
    }

    [HttpGet]
    public async Task<ActionResult<List<PaymentSubmissionDto>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] int? propertyId,
        [FromQuery] int? buildingId,
        [FromQuery] int? unitId)
    {
        var result = await _paymentSubmissionService.GetManagementSubmissionsAsync(
            GetCurrentUserId(),
            IsAdmin(),
            status,
            propertyId,
            buildingId,
            unitId);

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PaymentSubmissionDto>> GetById(int id)
    {
        var result = await _paymentSubmissionService.GetManagementSubmissionByIdAsync(id, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
    }

    [HttpGet("{id:int}/receipt")]
    public async Task<IActionResult> GetReceiptStream(int id)
    {
        var (stream, contentType, fileName) = await _paymentSubmissionService.GetReceiptStreamAsync(id, GetCurrentUserId(), IsAdmin());
        return File(stream, contentType, fileName);
    }

    [HttpPost("{id:int}/approve")]
    public async Task<ActionResult<PaymentSubmissionDto>> Approve(int id, [FromBody] ApprovePaymentSubmissionDto dto)
    {
        var result = await _paymentSubmissionService.ApproveSubmissionAsync(id, dto, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/reject")]
    public async Task<ActionResult<PaymentSubmissionDto>> Reject(int id, [FromBody] RejectPaymentSubmissionDto dto)
    {
        var result = await _paymentSubmissionService.RejectSubmissionAsync(id, dto, GetCurrentUserId(), IsAdmin());
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

    private static ErrorResponse CreateNotFoundResponse(int id)
    {
        return new ErrorResponse
        {
            StatusCode = 404,
            Message = $"ID'si {id} olan ödeme başvurusu bulunamadı.",
            Timestamp = DateTime.UtcNow
        };
    }
}
