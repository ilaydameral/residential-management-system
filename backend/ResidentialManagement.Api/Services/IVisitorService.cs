using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IVisitorService
{
    Task<VisitorDto> CreateVisitorAsync(int residentUserId, CreateVisitorDto dto);
    Task<List<VisitorDto>> GetResidentVisitorsAsync(int residentUserId, string? statusFilter = null, bool? upcomingOnly = null);
    Task<VisitorDto?> GetResidentVisitorByIdAsync(int residentUserId, long visitorId);
    Task<VisitorDto> CancelVisitorAsync(int residentUserId, long visitorId);

    Task<PagedVisitorResultDto> GetManagementVisitorsAsync(int userId, bool isAdmin, VisitorFilterDto filter);
    Task<VisitorDto?> GetManagementVisitorByIdAsync(int userId, bool isAdmin, long visitorId);
    Task<VisitorDto> CheckInVisitorAsync(int managerUserId, bool isAdmin, long visitorId);
    Task<VisitorDto> CheckOutVisitorAsync(int managerUserId, bool isAdmin, long visitorId);
}
