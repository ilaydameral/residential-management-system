using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public sealed class UnavailableAiVisionProvider : IAiVisionProvider
{
    public bool IsAvailable => false;

    public Task<AiVisionProviderResponse> AnalyzeAsync(
        AiVisionProviderRequest request,
        CancellationToken cancellationToken)
        => throw new AiUnavailableException();
}
