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

    Task<ImportConfirmResponseDto> ConfirmBatchAsync(
        int batchId,
        int currentUserId,
        bool isAdmin);

    Task<ImportSummaryResponseDto> GetSummaryAsync(
        int batchId,
        int currentUserId,
        bool isAdmin);

    Task<ImportRollbackResponseDto> RollbackBatchAsync(
        int batchId,
        int currentUserId,
        bool isAdmin);

    Task<(byte[] FileBytes, string ContentType, string FileName)> ExportErrorsCsvAsync(
        int batchId,
        int currentUserId,
        bool isAdmin);

    Task<ImportBatchListResponseDto> GetBatchesAsync(
        string? importType,
        string? status,
        int page,
        int pageSize,
        int currentUserId,
        bool isAdmin);
}
