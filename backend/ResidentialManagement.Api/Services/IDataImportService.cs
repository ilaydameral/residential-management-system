using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IDataImportService
{
    Task<ImportUploadResponseDto> UploadFileAsync(
        Microsoft.AspNetCore.Http.IFormFile file,
        string importType,
        int currentUserId,
        bool isAdmin);

    Task<ImportColumnMappingOptionsDto> GetColumnMappingOptionsAsync(
        int batchId,
        int currentUserId,
        bool isAdmin);

    Task<ImportPreviewResponseDto> ValidateBatchAsync(
        int batchId,
        ValidateImportBatchRequestDto request,
        int currentUserId,
        bool isAdmin);

    Task<ImportPreviewResponseDto> GetPreviewAsync(
        int batchId,
        string? actionFilter,
        int page,
        int pageSize,
        int currentUserId,
        bool isAdmin);
}
