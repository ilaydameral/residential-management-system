namespace ResidentialManagement.Api.Services;

public sealed record ValidatedMaintenanceImage(
    byte[] Bytes,
    string ContentType,
    int Width,
    int Height);

public interface IMaintenanceImageValidator
{
    Task<ValidatedMaintenanceImage> ValidateAsync(
        IFormFile image,
        CancellationToken cancellationToken);
}
