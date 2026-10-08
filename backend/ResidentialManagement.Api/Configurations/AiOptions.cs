namespace ResidentialManagement.Api.Configurations;

public sealed class AiOptions
{
    public const string SectionName = "Ai";

    public string Provider { get; set; } = "Disabled";
    public string Model { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 60;
    public AiVisionOptions Vision { get; set; } = new();
}

public sealed class AiVisionOptions
{
    public string Provider { get; set; } = "Disabled";
    public string Model { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 90;
}
