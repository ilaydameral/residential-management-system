using System.IO.Compression;
using System.Security.Cryptography;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class DocumentFileStorageService : IDocumentFileStorageService
{
    public const long MaxFileSizeBytes = 10L * 1024 * 1024;

    private static readonly IReadOnlyDictionary<string, string> ContentTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".pdf"] = "application/pdf",
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".png"] = "image/png",
            [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        };

    private readonly string _storageRoot;
    private readonly ILogger<DocumentFileStorageService> _logger;

    public DocumentFileStorageService(IHostEnvironment environment, ILogger<DocumentFileStorageService> logger)
    {
        _logger = logger;
        var root = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "App_Data", "documents"));
        _storageRoot = root.EndsWith(Path.DirectorySeparatorChar) ? root : root + Path.DirectorySeparatorChar;
        Directory.CreateDirectory(_storageRoot);
    }

    public async Task<(string StorageKey, string Sha256, long FileSize)> SaveAsync(
        Stream fileStream,
        string originalFileName,
        string contentType)
    {
        if (fileStream is null || !fileStream.CanRead || fileStream.Length <= 0)
        {
            throw new BadRequestException("Yüklenecek belge boş olamaz.");
        }

        if (fileStream.Length > MaxFileSizeBytes)
        {
            throw new BadRequestException("Belge boyutu 10 MB sınırını aşamaz.");
        }

        var extension = Path.GetExtension(Path.GetFileName(originalFileName)).ToLowerInvariant();
        if (!ContentTypes.TryGetValue(extension, out var expectedContentType))
        {
            throw new BadRequestException("Yalnızca PDF, JPG, JPEG, PNG, DOCX ve XLSX dosyaları kabul edilir.");
        }

        var normalizedContentType = contentType?.Split(';', 2)[0].Trim() ?? string.Empty;
        if (!normalizedContentType.Equals(expectedContentType, StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Dosya uzantısı ile içerik türü eşleşmiyor.");
        }

        await ValidateSignatureAsync(fileStream, extension);
        fileStream.Seek(0, SeekOrigin.Begin);

        var storageKey = $"{Guid.NewGuid():N}{extension}";
        var path = ResolvePath(storageKey);

        try
        {
            using var sha256 = SHA256.Create();
            await using var target = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true);
            var buffer = new byte[81920];
            int read;
            while ((read = await fileStream.ReadAsync(buffer)) > 0)
            {
                await target.WriteAsync(buffer.AsMemory(0, read));
                sha256.TransformBlock(buffer, 0, read, null, 0);
            }

            sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
            return (storageKey, Convert.ToHexString(sha256.Hash!).ToLowerInvariant(), fileStream.Length);
        }
        catch
        {
            FailedUploadCleanup.Run(() => Delete(storageKey), _logger);
            throw;
        }
    }

    public Stream OpenRead(string storageKey)
    {
        var path = ResolvePath(storageKey);
        if (!File.Exists(path))
        {
            throw new KeyNotFoundException("Belge dosyası bulunamadı.");
        }

        return File.OpenRead(path);
    }

    public bool Delete(string storageKey)
    {
        try
        {
            var path = ResolvePath(storageKey);
            if (!File.Exists(path)) return false;
            File.Delete(path);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private string ResolvePath(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey) || Path.GetFileName(storageKey) != storageKey)
        {
            throw new BadRequestException("Geçersiz belge depolama anahtarı.");
        }

        var path = Path.GetFullPath(Path.Combine(_storageRoot, storageKey));
        if (!path.StartsWith(_storageRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Geçersiz belge dosya yolu.");
        }

        return path;
    }

    private static async Task ValidateSignatureAsync(Stream stream, string extension)
    {
        var header = new byte[8];
        var read = await stream.ReadAsync(header);
        stream.Seek(0, SeekOrigin.Begin);

        var valid = extension switch
        {
            ".pdf" => read >= 4 && header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46,
            ".png" => read >= 8 && header.SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
            ".jpg" or ".jpeg" => read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
            ".docx" or ".xlsx" => read >= 4 && header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x03 && header[3] == 0x04,
            _ => false
        };

        if (!valid)
        {
            throw new BadRequestException("Dosya içeriği seçilen belge formatıyla eşleşmiyor.");
        }

        if (extension is ".docx" or ".xlsx")
        {
            try
            {
                using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
                var requiredPrefix = extension == ".docx" ? "word/" : "xl/";
                if (!archive.Entries.Any(entry => entry.FullName == "[Content_Types].xml") ||
                    !archive.Entries.Any(entry => entry.FullName.StartsWith(requiredPrefix, StringComparison.OrdinalIgnoreCase)))
                {
                    throw new BadRequestException("Office belgesi beklenen DOCX/XLSX yapısına sahip değil.");
                }
            }
            catch (InvalidDataException)
            {
                throw new BadRequestException("Office belgesi geçerli bir ZIP yapısına sahip değil.");
            }
            finally
            {
                stream.Seek(0, SeekOrigin.Begin);
            }
        }
    }
}
