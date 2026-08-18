using System.Security.Cryptography;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class ImportFileStorageService : IImportFileStorageService
{
    private readonly string _storagePath;
    private const long MaxFileSizeBytes = 20 * 1024 * 1024; // 20 MB

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".csv",
        ".xlsx"
    };

    public ImportFileStorageService(IHostEnvironment environment)
    {
        _storagePath = Path.Combine(environment.ContentRootPath, "App_Data", "imports");
        if (!Directory.Exists(_storagePath))
        {
            Directory.CreateDirectory(_storagePath);
        }
    }

    public async Task<(string StorageKey, string FileHashSha256, long FileSizeBytes)> SaveImportFileAsync(Stream fileStream, string originalFileName)
    {
        if (fileStream is null || fileStream.Length == 0)
        {
            throw new BadRequestException("İçe aktarılacak dosya boş olamaz.");
        }

        if (fileStream.Length > MaxFileSizeBytes)
        {
            throw new BadRequestException("İçe aktarma dosya boyutu 20 MB sınırını aşamaz.");
        }

        var extension = Path.GetExtension(originalFileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            throw new BadRequestException("Yalnızca CSV (.csv) ve Excel (.xlsx) formatındaki dosyalar kabul edilir.");
        }

        // Validate basic file magic bytes for XLSX zip container vs CSV text
        var header = new byte[4];
        var bytesRead = await fileStream.ReadAsync(header, 0, header.Length);
        fileStream.Seek(0, SeekOrigin.Begin);

        if (bytesRead < 4)
        {
            throw new BadRequestException("Geçersiz veya bozuk veri aktarım dosyası.");
        }

        if (extension.Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            // Zip container magic bytes: PK\x03\x04
            var isZipMagic = header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x03 && header[3] == 0x04;
            if (!isZipMagic)
            {
                throw new BadRequestException("Yüklenen dosya geçerli bir Excel (.xlsx) yapısına sahip değil.");
            }
        }

        // Generate GUID storage key (original filename is never used as physical file name)
        var storageKey = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var fullPath = Path.Combine(_storagePath, storageKey);

        // Path traversal validation
        var canonicalPath = Path.GetFullPath(fullPath);
        if (!canonicalPath.StartsWith(_storagePath, StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Geçersiz dosya yolu.");
        }

        using var sha256 = SHA256.Create();
        using var targetStream = File.Create(canonicalPath);

        var buffer = new byte[8192];
        int read;
        while ((read = await fileStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
        {
            await targetStream.WriteAsync(buffer, 0, read);
            sha256.TransformBlock(buffer, 0, read, null, 0);
        }
        sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);

        var hashBytes = sha256.Hash ?? Array.Empty<byte>();
        var hashHex = Convert.ToHexString(hashBytes).ToLowerInvariant();

        return (storageKey, hashHex, fileStream.Length);
    }

    public Stream OpenImportFileStream(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
        {
            throw new BadRequestException("Dosya depolama anahtarı belirtilmelidir.");
        }

        var fullPath = Path.GetFullPath(Path.Combine(_storagePath, storageKey));
        if (!fullPath.StartsWith(_storagePath, StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Geçersiz dosya depolama anahtarı.");
        }

        if (!File.Exists(fullPath))
        {
            throw new NotFoundException("İçe aktarma dosyası bulunamadı.");
        }

        return File.OpenRead(fullPath);
    }

    public bool DeleteImportFile(string storageKey)
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
