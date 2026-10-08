using System.Text.Json;

namespace ResidentialManagement.Api.IntegrationTests.Infrastructure;

internal static class HttpResponseExtensions
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    internal static async Task<T> ReadJsonAsync<T>(this HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(body, JsonOptions)
            ?? throw new Xunit.Sdk.XunitException($"Response body could not be deserialized as {typeof(T).Name}: {body}");
    }

    internal static async Task<JsonDocument> ReadJsonDocumentAsync(this HttpResponseMessage response)
        => JsonDocument.Parse(await response.Content.ReadAsStringAsync());
}
