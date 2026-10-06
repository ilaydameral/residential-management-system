using System.Text.Json;

namespace ResidentialManagement.Api.Services;

public sealed record AiVisionProviderRequest(
    string UseCase,
    string SystemInstruction,
    string UserContent,
    byte[] ImageBytes,
    string ImageContentType,
    int MaxOutputCharacters,
    JsonElement ResponseSchema,
    int MaxOutputTokens = 500);

public sealed record AiVisionProviderResponse(string Content);

public interface IAiVisionProvider
{
    bool IsAvailable { get; }
    Task<AiVisionProviderResponse> AnalyzeAsync(
        AiVisionProviderRequest request,
        CancellationToken cancellationToken);
}
