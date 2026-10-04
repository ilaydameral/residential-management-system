namespace ResidentialManagement.Api.Exceptions;

public sealed class AiUnavailableException : Exception
{
    public AiUnavailableException()
        : base("AI yardımcısı şu anda kullanılamıyor. Temel işlemlerinize AI desteği olmadan devam edebilirsiniz.")
    {
    }
}

public sealed class AiModelUnavailableException : Exception
{
    public AiModelUnavailableException()
        : base("AI yardımcısı için yapılandırılmış model bulunamadı. Lütfen daha sonra tekrar deneyin.")
    {
    }
}

public sealed class AiInvalidResponseException : Exception
{
    public AiInvalidResponseException()
        : base("AI yardımcısı geçerli bir yanıt üretemedi. Lütfen daha sonra tekrar deneyin.")
    {
    }
}

public sealed class AiTimeoutException : Exception
{
    public AiTimeoutException()
        : base("AI yardımcısı zamanında yanıt veremedi. Lütfen daha sonra tekrar deneyin.")
    {
    }
}

public sealed class AiRateLimitException : Exception
{
    public AiRateLimitException()
        : base("AI yardımcısı şu anda yoğun. Lütfen kısa bir süre sonra tekrar deneyin.")
    {
    }
}
