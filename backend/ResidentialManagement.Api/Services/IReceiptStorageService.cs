namespace ResidentialManagement.Api.Services;

public interface IReceiptStorageService
{
    Task<string> SaveReceiptFileAsync(IFormFile file);
    (Stream Stream, string ContentType, string FileName) GetReceiptFile(string storageKey);
    void DeleteReceiptFile(string storageKey);
}
