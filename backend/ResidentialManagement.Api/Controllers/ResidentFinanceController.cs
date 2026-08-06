using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/resident/finance")]
[Authorize(Roles = AppRoles.Resident)]
public class ResidentFinanceController : ControllerBase
{
    private readonly IPaymentSubmissionService _paymentSubmissionService;

    public ResidentFinanceController(IPaymentSubmissionService paymentSubmissionService)
    {
        _paymentSubmissionService = paymentSubmissionService;
    }

    [HttpGet("unit-charges")]
    public async Task<ActionResult<List<ResidentUnitChargeDto>>> GetMyUnitCharges()
    {
        var charges = await _paymentSubmissionService.GetMyUnitChargesAsync(GetCurrentUserId());
        return Ok(charges);
    }

    [HttpGet("unit-charges/{id:int}")]
    public async Task<ActionResult<ResidentUnitChargeDto>> GetMyUnitChargeById(int id)
    {
        var charge = await _paymentSubmissionService.GetMyUnitChargeByIdAsync(id, GetCurrentUserId());
        return charge is null
            ? NotFound(CreateNotFoundResponse($"ID'si {id} olan borç kaydı bulunamadı."))
            : Ok(charge);
    }

    [HttpPost("payment-submissions")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<PaymentSubmissionDto>> CreatePaymentSubmission([FromForm] CreatePaymentSubmissionRequestDto requestDto)
    {
        var result = await _paymentSubmissionService.CreateSubmissionAsync(requestDto, GetCurrentUserId());
        return CreatedAtAction(nameof(GetMySubmissionById), new { id = result.Id }, result);
    }

    [HttpGet("payment-submissions")]
    public async Task<ActionResult<List<PaymentSubmissionDto>>> GetMySubmissions()
    {
        var submissions = await _paymentSubmissionService.GetMySubmissionsAsync(GetCurrentUserId());
        return Ok(submissions);
    }

    [HttpGet("payment-submissions/{id:int}")]
    public async Task<ActionResult<PaymentSubmissionDto>> GetMySubmissionById(int id)
    {
        var submission = await _paymentSubmissionService.GetMySubmissionByIdAsync(id, GetCurrentUserId());
        return submission is null
            ? NotFound(CreateNotFoundResponse($"ID'si {id} olan ödeme başvurusu bulunamadı."))
            : Ok(submission);
    }

    [HttpGet("payment-submissions/{id:int}/receipt")]
    public async Task<IActionResult> GetReceiptStream(int id)
    {
        var (stream, contentType, fileName) = await _paymentSubmissionService.GetReceiptStreamAsync(id, GetCurrentUserId(), IsAdmin());
        return File(stream, contentType, fileName);
    }

    [HttpPost("payment-submissions/{id:int}/cancel")]
    public async Task<ActionResult<PaymentSubmissionDto>> CancelMySubmission(int id)
    {
        var result = await _paymentSubmissionService.CancelMySubmissionAsync(id, GetCurrentUserId());
        return result is null
            ? NotFound(CreateNotFoundResponse($"ID'si {id} olan ödeme başvurusu bulunamadı."))
            : Ok(result);
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

    private static ErrorResponse CreateNotFoundResponse(string message)
    {
        return new ErrorResponse
        {
            StatusCode = 404,
            Message = message,
            Timestamp = DateTime.UtcNow
        };
    }
}
