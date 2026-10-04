using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public sealed class UnavailableAiProvider : IAiProvider
{
    public bool IsAvailable => false;

    public Task<AiProviderResponse> GenerateAsync(
        AiProviderRequest request,
        CancellationToken cancellationToken)
        => Task.FromException<AiProviderResponse>(new AiUnavailableException());
}
