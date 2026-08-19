namespace ResidentialManagement.Api.Services;

public interface IRequestFileStorageService
{
    Task<(string StorageKey, long FileSizeBytes)> SaveAttachmentAsync(Stream fileStream, string originalFileName, string contentType);
    Stream OpenAttachmentStream(string storageKey);
    bool DeleteAttachmentFile(string storageKey);
}
