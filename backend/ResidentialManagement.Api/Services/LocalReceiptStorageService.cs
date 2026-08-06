using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class LocalReceiptStorageService : IReceiptStorageService
{
    private readonly string _storagePath;
    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    private static readonly Dictionary<string, (string ContentType, byte[][] MagicBytes)> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        { ".pdf", ("application/pdf", new[] { new byte[] { 0x25, 0x50, 0x44, 0x46 } }) },
        { ".png", ("image/png", new[] { new byte[] { 0x89, 0x50, 0x4E, 0x47 } }) },
        { ".jpg", ("image/jpeg", new[] { new byte[] { 0xFF, 0xD8, 0xFF } }) },
        { ".jpeg", ("image/jpeg", new[] { new byte[] { 0xFF, 0xD8, 0xFF } }) }
    };

    public LocalReceiptStorageService(IHostEnvironment environment)
    {
        _storagePath = Path.Combine(environment.ContentRootPath, "App_Data", "receipts");
        if (!Directory.Exists(_storagePath))
        {
            Directory.CreateDirectory(_storagePath);
        }
    }

    public async Task<string> SaveReceiptFileAsync(IFormFile file)
    {
        if (file is null || file.Length == 0)
        {
            throw new BadRequestException("Dekont dosyası yüklemek zorunludur.");
        }

        if (file.Length > MaxFileSizeBytes)
        {
            throw new BadRequestException("Dekont dosya boyutu 5 MB sınırını aşamaz.");
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedTypes.TryGetValue(extension, out var typeInfo))
        {
            throw new BadRequestException("Yalnızca PDF, PNG, JPG ve JPEG formatındaki dekont dosyaları kabul edilir.");
        }

        // Magic byte verification
        using var stream = file.OpenReadStream();
        var header = new byte[8];
        var bytesRead = await stream.ReadAsync(header, 0, header.Length);
        if (bytesRead < 4)
        {
            throw new BadRequestException("Geçersiz veya bozuk dekont dosyası.");
        }

        var isMagicValid = typeInfo.MagicBytes.Any(magic =>
            header.Take(magic.Length).SequenceEqual(magic));

        if (!isMagicValid)
        {
            throw new BadRequestException("Dekont dosyasının içeriği belirtilen dosya uzantısı ile eşleşmiyor.");
        }

        var storageKey = $"receipt_{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var targetFilePath = Path.Combine(_storagePath, storageKey);

        stream.Position = 0;
        using var targetStream = File.Create(targetFilePath);
        await stream.CopyToAsync(targetStream);

        return storageKey;
    }

    public (Stream Stream, string ContentType, string FileName) GetReceiptFile(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
        {
            throw new KeyNotFoundException("Dekont dosyası bulunamadı.");
        }

        var sanitizedKey = Path.GetFileName(storageKey);
        var filePath = Path.Combine(_storagePath, sanitizedKey);

        if (!File.Exists(filePath))
        {
            throw new KeyNotFoundException("Dekont dosyası disk üzerinde bulunamadı.");
        }

        var extension = Path.GetExtension(sanitizedKey);
        var contentType = AllowedTypes.TryGetValue(extension, out var typeInfo)
            ? typeInfo.ContentType
            : "application/octet-stream";

        var stream = File.OpenRead(filePath);
        return (stream, contentType, sanitizedKey);
    }

    public void DeleteReceiptFile(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey)) return;

        try
        {
            var sanitizedKey = Path.GetFileName(storageKey);
            var filePath = Path.Combine(_storagePath, sanitizedKey);
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }
        catch
        {
            // Ignore file deletion errors during orphan cleanup
        }
    }
}
