namespace ResidentialManagement.Api.Services;

public interface IImportFileStorageService
{
    Task<(string StorageKey, string FileHashSha256, long FileSizeBytes)> SaveImportFileAsync(Stream fileStream, string originalFileName);
    Stream OpenImportFileStream(string storageKey);
    bool DeleteImportFile(string storageKey);
}
