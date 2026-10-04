using System.Text.Json;

namespace ResidentialManagement.Api.Services;

public sealed record AiProviderRequest(
    string UseCase,
    string SystemInstruction,
    string UserContent,
    int MaxOutputCharacters,
    JsonElement? ResponseSchema = null,
    int MaxOutputTokens = 500);

public sealed record AiProviderResponse(string Content);

public interface IAiProvider
{
    bool IsAvailable { get; }
    Task<AiProviderResponse> GenerateAsync(AiProviderRequest request, CancellationToken cancellationToken);
}
