using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IMaintenanceRequestService
{
    Task<MaintenanceRequestDetailDto> CreateRequestAsync(MaintenanceRequestCreateDto dto, int residentUserId);

    Task<MaintenanceRequestListResponseDto> GetResidentRequestsAsync(string? status, string? category, int page, int pageSize, int residentUserId);

    Task<MaintenanceRequestDetailDto> GetResidentRequestByIdAsync(int id, int residentUserId);

    Task<MaintenanceRequestDetailDto> CancelResidentRequestAsync(int id, int residentUserId);

    Task<MaintenanceRequestDetailDto> UpdateResidentResolvedRequestStatusAsync(int id, string newStatus, string? note, int residentUserId);

    Task<MaintenanceRequestAttachmentDto> AddAttachmentAsync(int requestId, Stream fileStream, string originalFileName, string contentType, int userId, bool isAdmin);

    Task<(Stream FileStream, string ContentType, string OriginalFileName)> GetAttachmentStreamAsync(int requestId, int attachmentId, int userId, bool isAdmin);

    Task<MaintenanceRequestListResponseDto> GetManagementRequestsAsync(
        int? propertyId,
        int? buildingId,
        int? unitId,
        string? status,
        string? priority,
        string? category,
        int? assignedToUserId,
        string? search,
        int page,
        int pageSize,
        int userId,
        bool isAdmin);

    Task<MaintenanceRequestDetailDto> GetManagementRequestByIdAsync(int id, int userId, bool isAdmin);

    Task<MaintenanceRequestDetailDto> AssignTechnicianAsync(int requestId, int assignedToUserId, int userId, bool isAdmin);

    Task<MaintenanceRequestDetailDto> UpdatePriorityAsync(int requestId, string priority, int userId, bool isAdmin);

    Task<MaintenanceRequestDetailDto> UpdateStatusAsync(int requestId, string newStatus, string? note, int userId, bool isAdmin);

    Task<MaintenanceRequestDetailDto> AddWorkNoteAsync(int requestId, string note, int userId, bool isAdmin);

    Task<MaintenanceRequestListResponseDto> GetTechnicalRequestsAsync(string? status, string? priority, string? category, int page, int pageSize, int technicalUserId);

    Task<MaintenanceRequestDetailDto> GetTechnicalRequestByIdAsync(int id, int technicalUserId);
}
