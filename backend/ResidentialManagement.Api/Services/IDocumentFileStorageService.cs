namespace ResidentialManagement.Api.Services;

public interface IDocumentFileStorageService
{
    Task<(string StorageKey, string Sha256, long FileSize)> SaveAsync(
        Stream fileStream,
        string originalFileName,
        string contentType);
    Stream OpenRead(string storageKey);
    bool Delete(string storageKey);
}
