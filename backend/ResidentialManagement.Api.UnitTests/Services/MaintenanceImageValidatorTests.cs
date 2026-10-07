using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.UnitTests.Services;

public class MaintenanceImageValidatorTests
{
    private readonly MaintenanceImageValidator _validator = new();

    [Fact]
    public async Task ValidateAsync_ValidPngHeader_ReturnsDimensionsAndContentType()
    {
        var result = await _validator.ValidateAsync(
            FormFile(Png(320, 240), "image.png", "image/png"),
            CancellationToken.None);

        Assert.Equal("image/png", result.ContentType);
        Assert.Equal(320, result.Width);
        Assert.Equal(240, result.Height);
    }

    [Fact]
    public async Task ValidateAsync_ValidJpegHeader_ReturnsDimensions()
    {
        var result = await _validator.ValidateAsync(
            FormFile(Jpeg(640, 480), "image.jpg", "image/jpeg"),
            CancellationToken.None);

        Assert.Equal(640, result.Width);
        Assert.Equal(480, result.Height);
    }

    [Fact]
    public async Task ValidateAsync_FakeJpeg_IsRejected()
    {
        await Assert.ThrowsAsync<BadRequestException>(() => _validator.ValidateAsync(
            FormFile([0x00, 0x01, 0x02], "image.jpg", "image/jpeg"),
            CancellationToken.None));
    }

    [Fact]
    public async Task ValidateAsync_UnsupportedContentType_IsRejected()
    {
        await Assert.ThrowsAsync<BadRequestException>(() => _validator.ValidateAsync(
            FormFile(Png(1, 1), "image.gif", "image/gif"),
            CancellationToken.None));
    }

    [Fact]
    public async Task ValidateAsync_ReportedSizeOverFiveMegabytes_IsRejectedBeforeReadingStream()
    {
        var file = new ReportedLengthFormFile(MaintenanceImageValidator.MaximumFileSizeBytes + 1);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _validator.ValidateAsync(file, CancellationToken.None));
        Assert.False(file.StreamOpened);
    }

    [Fact]
    public async Task ValidateAsync_ExcessivePixelCount_IsRejected()
    {
        await Assert.ThrowsAsync<BadRequestException>(() => _validator.ValidateAsync(
            FormFile(Png(8_000, 8_000), "image.png", "image/png"),
            CancellationToken.None));
    }

    private static FormFile FormFile(byte[] bytes, string fileName, string contentType)
        => new(new MemoryStream(bytes), 0, bytes.Length, "image", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };

    private static byte[] Png(int width, int height)
    {
        var bytes = new byte[24];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }.CopyTo(bytes, 0);
        WriteBigEndian(bytes, 8, 13);
        "IHDR"u8.CopyTo(bytes.AsSpan(12, 4));
        WriteBigEndian(bytes, 16, width);
        WriteBigEndian(bytes, 20, height);
        return bytes;
    }

    private static byte[] Jpeg(int width, int height)
        =>
        [
            0xFF, 0xD8,
            0xFF, 0xC0,
            0x00, 0x07,
            0x08,
            (byte)(height >> 8), (byte)height,
            (byte)(width >> 8), (byte)width
        ];

    private static void WriteBigEndian(byte[] bytes, int offset, int value)
    {
        bytes[offset] = (byte)(value >> 24);
        bytes[offset + 1] = (byte)(value >> 16);
        bytes[offset + 2] = (byte)(value >> 8);
        bytes[offset + 3] = (byte)value;
    }

    private sealed class ReportedLengthFormFile(long length) : IFormFile
    {
        public bool StreamOpened { get; private set; }
        public string ContentType => "image/png";
        public string ContentDisposition => new ContentDispositionHeaderValue("form-data").ToString();
        public IHeaderDictionary Headers { get; } = new HeaderDictionary();
        public long Length => length;
        public string Name => "image";
        public string FileName => "image.png";

        public void CopyTo(Stream target) => throw new NotSupportedException();
        public Task CopyToAsync(Stream target, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Stream OpenReadStream()
        {
            StreamOpened = true;
            return Stream.Null;
        }
    }
}
