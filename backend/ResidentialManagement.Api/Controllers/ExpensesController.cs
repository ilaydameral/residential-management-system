using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.Controllers;

[ApiController]
[Route("api/expenses")]
[Authorize(Roles = AppRoles.AdminOrManager)]
public class ExpensesController : ControllerBase
{
    private readonly IExpenseService _expenseService;

    public ExpensesController(IExpenseService expenseService)
    {
        _expenseService = expenseService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ExpenseDto>>> GetAll(
        [FromQuery] int? propertyId,
        [FromQuery] int? buildingId,
        [FromQuery] string? category,
        [FromQuery] bool? isCancelled,
        [FromQuery] bool? isApportioned)
    {
        var result = await _expenseService.GetAllAsync(
            GetCurrentUserId(),
            IsAdmin(),
            propertyId,
            buildingId,
            category,
            isCancelled,
            isApportioned);

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ExpenseDto>> GetById(int id)
    {
        var result = await _expenseService.GetByIdAsync(id, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<ExpenseDto>> Create([FromBody] CreateExpenseDto createDto)
    {
        var result = await _expenseService.CreateAsync(createDto, GetCurrentUserId(), IsAdmin());
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ExpenseDto>> Update(int id, [FromBody] UpdateExpenseDto updateDto)
    {
        var result = await _expenseService.UpdateAsync(id, updateDto, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<ExpenseDto>> Cancel(int id, [FromBody] CancelExpenseDto cancelDto)
    {
        var result = await _expenseService.CancelAsync(id, cancelDto, GetCurrentUserId(), IsAdmin());
        return result is null
            ? NotFound(CreateNotFoundResponse(id))
            : Ok(result);
    }

    [HttpPost("{id:int}/apportionment-preview")]
    public async Task<ActionResult<ExpenseApportionmentPreviewDto>> GetPreview(int id, [FromBody] ApportionExpenseDto apportionDto)
    {
        var result = await _expenseService.GetApportionmentPreviewAsync(id, apportionDto, GetCurrentUserId(), IsAdmin());
        return Ok(result);
    }

    [HttpPost("{id:int}/apportion")]
    public async Task<ActionResult<ApportionExpenseResultDto>> Apportion(int id, [FromBody] ApportionExpenseDto apportionDto)
    {
        var result = await _expenseService.ApportionExpenseAsync(id, apportionDto, GetCurrentUserId(), IsAdmin());
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
            Message = $"ID'si {id} olan gider kaydı bulunamadı.",
            Timestamp = DateTime.UtcNow
        };
    }
}
