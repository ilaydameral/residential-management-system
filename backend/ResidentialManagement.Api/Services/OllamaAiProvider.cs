using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ResidentialManagement.Api.Configurations;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public sealed class OllamaAiProvider : IAiProvider
{
    private const int ResponseEnvelopeAllowance = 32_768;
    private static readonly JsonSerializerOptions ResponseJsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _httpClient;
    private readonly AiOptions _options;
    private readonly ILogger<OllamaAiProvider> _logger;
    private readonly Uri? _chatEndpoint;

    public OllamaAiProvider(
        HttpClient httpClient,
        IOptions<AiOptions> options,
        ILogger<OllamaAiProvider> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
        _chatEndpoint = BuildChatEndpoint(_options.BaseUrl);
    }

    public bool IsAvailable =>
        !string.IsNullOrWhiteSpace(_options.Model) &&
        _chatEndpoint is not null;

    public async Task<AiProviderResponse> GenerateAsync(
        AiProviderRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsAvailable)
        {
            throw new AiUnavailableException();
        }

        var stopwatch = Stopwatch.StartNew();
        var providerUserContent = request.ResponseSchema.HasValue
            ? $"{request.UserContent}\nRESPONSE_JSON_SCHEMA={request.ResponseSchema.Value.GetRawText()}"
            : request.UserContent;
        object responseFormat = request.ResponseSchema.HasValue
            ? request.ResponseSchema.Value
            : "json";
        var payload = new
        {
            model = _options.Model.Trim(),
            messages = new[]
            {
                new { role = "system", content = request.SystemInstruction },
                new
                {
                    role = "user",
                    content = providerUserContent
                }
            },
            stream = false,
            format = responseFormat,
            options = new
            {
                temperature = 0,
                seed = 42,
                num_predict = request.MaxOutputTokens
            }
        };

        try
        {
            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, _chatEndpoint)
            {
                Content = JsonContent.Create(payload)
            };
            using var response = await _httpClient.SendAsync(
                httpRequest,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                LogFailure(request.UseCase, stopwatch.ElapsedMilliseconds, response.StatusCode);
                ThrowForStatus(response.StatusCode);
            }

            await using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var responseJson = await ReadBoundedAsync(
                responseStream,
                request.MaxOutputCharacters + ResponseEnvelopeAllowance,
                cancellationToken);

            OllamaChatResponse? providerResponse;
            try
            {
                providerResponse = JsonSerializer.Deserialize<OllamaChatResponse>(responseJson, ResponseJsonOptions);
            }
            catch (JsonException)
            {
                throw new AiInvalidResponseException();
            }

            var content = providerResponse?.Message?.Content;
            if (providerResponse is null || !providerResponse.Done ||
                string.IsNullOrWhiteSpace(content) || content.Length > request.MaxOutputCharacters)
            {
                throw new AiInvalidResponseException();
            }

            _logger.LogInformation(
                "AI provider request completed. Provider=Ollama Model={Model} UseCase={UseCase} DurationMs={DurationMs}",
                _options.Model,
                request.UseCase,
                stopwatch.ElapsedMilliseconds);

            return new AiProviderResponse(content);
        }
        catch (HttpRequestException)
        {
            _logger.LogWarning(
                "AI provider connection failed. Provider=Ollama Model={Model} UseCase={UseCase}",
                _options.Model,
                request.UseCase);
            throw new AiUnavailableException();
        }
    }

    private void LogFailure(string useCase, long durationMs, HttpStatusCode statusCode)
    {
        _logger.LogWarning(
            "AI provider request failed. Provider=Ollama Model={Model} UseCase={UseCase} StatusCode={StatusCode} DurationMs={DurationMs}",
            _options.Model,
            useCase,
            (int)statusCode,
            durationMs);
    }

    private static void ThrowForStatus(HttpStatusCode statusCode)
    {
        if (statusCode == HttpStatusCode.NotFound)
        {
            throw new AiModelUnavailableException();
        }

        if ((int)statusCode == 429)
        {
            throw new AiRateLimitException();
        }

        if (statusCode is HttpStatusCode.InternalServerError or HttpStatusCode.BadGateway or HttpStatusCode.ServiceUnavailable)
        {
            throw new AiUnavailableException();
        }

        throw new AiInvalidResponseException();
    }

    private static Uri? BuildChatEndpoint(string baseUrl)
    {
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var parsed) ||
            parsed.Scheme is not ("http" or "https"))
        {
            return null;
        }

        var normalizedBase = new Uri($"{parsed.AbsoluteUri.TrimEnd('/')}/", UriKind.Absolute);
        return new Uri(normalizedBase, "api/chat");
    }

    private static async Task<string> ReadBoundedAsync(
        Stream stream,
        int maxCharacters,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, true, 4096, leaveOpen: false);
        var buffer = new char[4096];
        var result = new StringBuilder(Math.Min(maxCharacters, 8192));

        while (true)
        {
            var read = await reader.ReadAsync(buffer.AsMemory(), cancellationToken);
            if (read == 0)
            {
                break;
            }

            if (result.Length + read > maxCharacters)
            {
                throw new AiInvalidResponseException();
            }

            result.Append(buffer, 0, read);
        }

        return result.ToString();
    }

    private sealed class OllamaChatResponse
    {
        public OllamaMessage? Message { get; set; }
        public bool Done { get; set; }
    }

    private sealed class OllamaMessage
    {
        public string Content { get; set; } = string.Empty;
    }
}
