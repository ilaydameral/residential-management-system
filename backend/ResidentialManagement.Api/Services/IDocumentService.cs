using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IDocumentService
{
    Task<DocumentListResponseDto> GetManagementAsync(int? propertyId, int? buildingId, int? unitId,
        string? category, string? visibility, bool? isActive, string? search, int page, int pageSize,
        int userId, bool isAdmin);
    Task<DocumentDto> GetManagementByIdAsync(int id, int userId, bool isAdmin);
    Task<DocumentDto> CreateAsync(CreateDocumentRequestDto request, int userId, bool isAdmin);
    Task<DocumentDto> UpdateMetadataAsync(int id, UpdateDocumentMetadataDto request, int userId, bool isAdmin);
    Task<DocumentDto> SetStatusAsync(int id, bool isActive, int userId, bool isAdmin);
    Task<(Stream Stream, string ContentType, string FileName)> DownloadManagementAsync(int id, int userId, bool isAdmin);

    Task<DocumentListResponseDto> GetResidentAsync(string? category, string? search, int page, int pageSize, int userId);
    Task<DocumentDto> GetResidentByIdAsync(int id, int userId);
    Task<(Stream Stream, string ContentType, string FileName)> DownloadResidentAsync(int id, int userId);
}
