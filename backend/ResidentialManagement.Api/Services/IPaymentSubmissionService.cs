using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IPaymentSubmissionService
{
    // Resident Operations
    Task<List<ResidentUnitChargeDto>> GetMyUnitChargesAsync(int residentUserId);
    Task<ResidentUnitChargeDto?> GetMyUnitChargeByIdAsync(int id, int residentUserId);
    Task<PaymentSubmissionDto> CreateSubmissionAsync(CreatePaymentSubmissionRequestDto requestDto, int residentUserId);
    Task<List<PaymentSubmissionDto>> GetMySubmissionsAsync(int residentUserId);
    Task<PaymentSubmissionDto?> GetMySubmissionByIdAsync(int id, int residentUserId);
    Task<PaymentSubmissionDto?> CancelMySubmissionAsync(int id, int residentUserId);

    // Management Operations
    Task<List<PaymentSubmissionDto>> GetManagementSubmissionsAsync(
        int currentUserId,
        bool isAdmin,
        string? status,
        int? propertyId,
        int? buildingId,
        int? unitId);

    Task<PaymentSubmissionDto?> GetManagementSubmissionByIdAsync(int id, int currentUserId, bool isAdmin);
    Task<PaymentSubmissionDto> ApproveSubmissionAsync(int id, ApprovePaymentSubmissionDto dto, int reviewerUserId, bool isAdmin);
    Task<PaymentSubmissionDto> RejectSubmissionAsync(int id, RejectPaymentSubmissionDto dto, int reviewerUserId, bool isAdmin);

    // Common Receipt Access
    Task<(Stream Stream, string ContentType, string FileName)> GetReceiptStreamAsync(int submissionId, int currentUserId, bool isAdmin);
}
