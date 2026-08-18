using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class RequestFileStorageService : IRequestFileStorageService
{
    private readonly string _storagePath;
    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".pdf"
    };

    public RequestFileStorageService(IHostEnvironment environment)
    {
        _storagePath = Path.Combine(environment.ContentRootPath, "App_Data", "request_attachments");
        if (!Directory.Exists(_storagePath))
        {
            Directory.CreateDirectory(_storagePath);
        }
    }

    public async Task<(string StorageKey, long FileSizeBytes)> SaveAttachmentAsync(Stream fileStream, string originalFileName, string contentType)
    {
        if (fileStream is null || fileStream.Length == 0)
        {
            throw new BadRequestException("Yüklenmek istenen dosya boş olamaz.");
        }

        if (fileStream.Length > MaxFileSizeBytes)
        {
            throw new BadRequestException("Dosya boyutu 5 MB sınırını aşamaz.");
        }

        var extension = Path.GetExtension(originalFileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            throw new BadRequestException("Yalnızca Görsel (.jpg, .jpeg, .png) veya PDF (.pdf) formatındaki dosyalar kabul edilir.");
        }

        // Basic magic byte validation
        var header = new byte[4];
        var bytesRead = await fileStream.ReadAsync(header, 0, header.Length);
        fileStream.Seek(0, SeekOrigin.Begin);

        if (bytesRead < 4)
        {
            throw new BadRequestException("Geçersiz veya bozuk dosya.");
        }

        if (extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            // PDF Magic Bytes: %PDF
            if (header[0] != 0x25 || header[1] != 0x50 || header[2] != 0x44 || header[3] != 0x46)
            {
                throw new BadRequestException("Yüklenen dosya geçerli bir PDF yapısına sahip değil.");
            }
        }
        else if (extension.Equals(".png", StringComparison.OrdinalIgnoreCase))
        {
            // PNG Magic Bytes: \x89PNG
            if (header[0] != 0x89 || header[1] != 0x50 || header[2] != 0x4E || header[3] != 0x47)
            {
                throw new BadRequestException("Yüklenen dosya geçerli bir PNG yapısına sahip değil.");
            }
        }
        else if (extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) || extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase))
        {
            // JPEG Magic Bytes: \xFF\xD8\xFF
            if (header[0] != 0xFF || header[1] != 0xD8 || header[2] != 0xFF)
            {
                throw new BadRequestException("Yüklenen dosya geçerli bir JPEG/JPG yapısına sahip değil.");
            }
        }

        var storageKey = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var fullPath = Path.Combine(_storagePath, storageKey);

        var canonicalPath = Path.GetFullPath(fullPath);
        if (!canonicalPath.StartsWith(_storagePath, StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Geçersiz dosya yolu.");
        }

        using (var targetStream = File.Create(canonicalPath))
        {
            await fileStream.CopyToAsync(targetStream);
        }

        return (storageKey, fileStream.Length);
    }

    public Stream OpenAttachmentStream(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
        {
            throw new BadRequestException("Dosya anahtarı belirtilmelidir.");
        }

        var fullPath = Path.GetFullPath(Path.Combine(_storagePath, storageKey));
        if (!fullPath.StartsWith(_storagePath, StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Geçersiz dosya anahtarı.");
        }

        if (!File.Exists(fullPath))
        {
            throw new NotFoundException("Dosya bulunamadı.");
        }

        return File.OpenRead(fullPath);
    }

    public bool DeleteAttachmentFile(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey)) return false;

        var fullPath = Path.GetFullPath(Path.Combine(_storagePath, storageKey));
        if (!fullPath.StartsWith(_storagePath, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            return true;
        }

        return false;
    }
}
