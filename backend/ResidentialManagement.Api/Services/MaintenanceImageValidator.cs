using System.Buffers.Binary;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public sealed class MaintenanceImageValidator : IMaintenanceImageValidator
{
    public const long MaximumFileSizeBytes = 5 * 1024 * 1024;
    private const int MaximumDimension = 8192;
    private const long MaximumPixelCount = 24_000_000;

    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    public async Task<ValidatedMaintenanceImage> ValidateAsync(
        IFormFile image,
        CancellationToken cancellationToken)
    {
        if (image is null || image.Length <= 0)
        {
            throw new BadRequestException("Analiz için boş olmayan bir görsel seçin.");
        }

        if (image.Length > MaximumFileSizeBytes)
        {
            throw new BadRequestException("Görsel boyutu 5 MB sınırını aşamaz.");
        }

        var contentType = image.ContentType?.Trim().ToLowerInvariant();
        var extension = Path.GetExtension(image.FileName);
        var isPng = contentType == "image/png" && extension.Equals(".png", StringComparison.OrdinalIgnoreCase);
        var isJpeg = contentType == "image/jpeg" &&
            (extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) ||
             extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase));
        if (!isPng && !isJpeg)
        {
            throw new BadRequestException("Görsel analizi yalnızca JPG veya PNG dosyalarını destekler.");
        }

        await using var source = image.OpenReadStream();
        using var buffer = new MemoryStream((int)Math.Min(image.Length, MaximumFileSizeBytes));
        await source.CopyToAsync(buffer, cancellationToken);
        if (buffer.Length <= 0 || buffer.Length > MaximumFileSizeBytes)
        {
            throw new BadRequestException("Görsel boyutu geçersiz veya 5 MB sınırını aşıyor.");
        }

        var bytes = buffer.ToArray();
        var dimensions = isPng ? ReadPngDimensions(bytes) : ReadJpegDimensions(bytes);
        if (dimensions.Width <= 0 || dimensions.Height <= 0 ||
            dimensions.Width > MaximumDimension || dimensions.Height > MaximumDimension ||
            (long)dimensions.Width * dimensions.Height > MaximumPixelCount)
        {
            throw new BadRequestException("Görsel boyutları güvenli analiz sınırlarını aşıyor.");
        }

        return new ValidatedMaintenanceImage(bytes, contentType!, dimensions.Width, dimensions.Height);
    }

    private static (int Width, int Height) ReadPngDimensions(byte[] bytes)
    {
        if (bytes.Length < 24 ||
            !bytes.AsSpan(0, PngSignature.Length).SequenceEqual(PngSignature) ||
            BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(8, 4)) != 13 ||
            !bytes.AsSpan(12, 4).SequenceEqual("IHDR"u8))
        {
            throw new BadRequestException("Yüklenen dosya geçerli bir PNG görseli değil.");
        }

        var width = BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(16, 4));
        var height = BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(20, 4));
        return (width, height);
    }

    private static (int Width, int Height) ReadJpegDimensions(byte[] bytes)
    {
        if (bytes.Length < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8)
        {
            throw new BadRequestException("Yüklenen dosya geçerli bir JPEG görseli değil.");
        }

        var offset = 2;
        while (offset + 3 < bytes.Length)
        {
            while (offset < bytes.Length && bytes[offset] == 0xFF)
            {
                offset++;
            }

            if (offset >= bytes.Length)
            {
                break;
            }

            var marker = bytes[offset++];
            if (marker is 0xD8 or 0xD9 || marker is >= 0xD0 and <= 0xD7)
            {
                continue;
            }

            if (offset + 1 >= bytes.Length)
            {
                break;
            }

            var segmentLength = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(offset, 2));
            if (segmentLength < 2 || offset + segmentLength > bytes.Length)
            {
                throw new BadRequestException("Yüklenen JPEG görseli bozuk veya eksik.");
            }

            if (IsStartOfFrame(marker))
            {
                if (segmentLength < 7)
                {
                    break;
                }

                var height = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(offset + 3, 2));
                var width = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(offset + 5, 2));
                return (width, height);
            }

            offset += segmentLength;
        }

        throw new BadRequestException("JPEG görselinin boyut bilgisi doğrulanamadı.");
    }

    private static bool IsStartOfFrame(byte marker)
        => marker is 0xC0 or 0xC1 or 0xC2 or 0xC3 or 0xC5 or 0xC6 or 0xC7 or
            0xC9 or 0xCA or 0xCB or 0xCD or 0xCE or 0xCF;
}
