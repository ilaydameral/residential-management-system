using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ResidentialManagement.Api.Configurations;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public sealed class OllamaAiVisionProvider : IAiVisionProvider
{
    private const int ResponseEnvelopeAllowance = 32_768;
    private static readonly JsonSerializerOptions ResponseJsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _httpClient;
    private readonly AiVisionOptions _options;
    private readonly ILogger<OllamaAiVisionProvider> _logger;
    private readonly Uri? _chatEndpoint;

    public OllamaAiVisionProvider(
        HttpClient httpClient,
        IOptions<AiOptions> options,
        ILogger<OllamaAiVisionProvider> logger)
    {
        _httpClient = httpClient;
        _options = options.Value.Vision;
        _logger = logger;
        _chatEndpoint = BuildChatEndpoint(_options.BaseUrl);
    }

    public bool IsAvailable =>
        !string.IsNullOrWhiteSpace(_options.Model) &&
        _chatEndpoint is not null;

    public async Task<AiVisionProviderResponse> AnalyzeAsync(
        AiVisionProviderRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsAvailable)
        {
            throw new AiUnavailableException();
        }

        var stopwatch = Stopwatch.StartNew();
        var providerUserContent =
            $"{request.UserContent}\nRESPONSE_JSON_SCHEMA={request.ResponseSchema.GetRawText()}";
        var payload = new
        {
            model = _options.Model.Trim(),
            messages = new object[]
            {
                new { role = "system", content = request.SystemInstruction },
                new
                {
                    role = "user",
                    content = providerUserContent,
                    images = new[] { Convert.ToBase64String(request.ImageBytes) }
                }
            },
            stream = false,
            format = request.ResponseSchema,
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
                _logger.LogWarning(
                    "AI vision provider request failed. Provider=Ollama Model={Model} UseCase={UseCase} StatusCode={StatusCode} DurationMs={DurationMs}",
                    _options.Model,
                    request.UseCase,
                    (int)response.StatusCode,
                    stopwatch.ElapsedMilliseconds);
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
                "AI vision request completed. Provider=Ollama Model={Model} UseCase={UseCase} ImageBytes={ImageBytes} DurationMs={DurationMs}",
                _options.Model,
                request.UseCase,
                request.ImageBytes.Length,
                stopwatch.ElapsedMilliseconds);

            return new AiVisionProviderResponse(content);
        }
        catch (HttpRequestException)
        {
            _logger.LogWarning(
                "AI vision provider connection failed. Provider=Ollama Model={Model} UseCase={UseCase}",
                _options.Model,
                request.UseCase);
            throw new AiUnavailableException();
        }
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
