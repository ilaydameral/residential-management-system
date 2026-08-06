using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IExpenseService
{
    Task<List<ExpenseDto>> GetAllAsync(
        int currentUserId,
        bool isAdmin,
        int? propertyId,
        int? buildingId,
        string? category,
        bool? isCancelled,
        bool? isApportioned);

    Task<ExpenseDto?> GetByIdAsync(
        int id,
        int currentUserId,
        bool isAdmin);

    Task<ExpenseDto> CreateAsync(
        CreateExpenseDto createDto,
        int currentUserId,
        bool isAdmin);

    Task<ExpenseDto?> UpdateAsync(
        int id,
        UpdateExpenseDto updateDto,
        int currentUserId,
        bool isAdmin);

    Task<ExpenseDto?> CancelAsync(
        int id,
        CancelExpenseDto cancelDto,
        int currentUserId,
        bool isAdmin);

    Task<ExpenseApportionmentPreviewDto> GetApportionmentPreviewAsync(
        int expenseId,
        ApportionExpenseDto apportionDto,
        int currentUserId,
        bool isAdmin);

    Task<ApportionExpenseResultDto> ApportionExpenseAsync(
        int expenseId,
        ApportionExpenseDto apportionDto,
        int currentUserId,
        bool isAdmin);
}
