using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IAnnouncementService
{
    Task<AnnouncementListResponseDto> GetManagementAnnouncementsAsync(
        int? propertyId,
        int? buildingId,
        string? status,
        string? priority,
        string? search,
        int page,
        int pageSize,
        int userId,
        bool isAdmin);

    Task<AnnouncementDetailDto> GetManagementAnnouncementByIdAsync(int id, int userId, bool isAdmin);

    Task<AnnouncementDetailDto> CreateDraftAnnouncementAsync(AnnouncementCreateDto dto, int userId, bool isAdmin);

    Task<AnnouncementDetailDto> UpdateAnnouncementAsync(int id, AnnouncementUpdateDto dto, int userId, bool isAdmin);

    Task<AnnouncementDetailDto> PublishAnnouncementAsync(int id, int userId, bool isAdmin);

    Task<AnnouncementDetailDto> CancelAnnouncementAsync(int id, int userId, bool isAdmin);

    Task<AnnouncementListResponseDto> GetResidentAnnouncementsAsync(
        string? priority,
        string? search,
        int page,
        int pageSize,
        int residentUserId);

    Task<AnnouncementDetailDto> GetResidentAnnouncementByIdAsync(int id, int residentUserId);
}
