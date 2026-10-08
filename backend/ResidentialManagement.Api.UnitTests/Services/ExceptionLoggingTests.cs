using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Logging;
using ResidentialManagement.Api.Exceptions;
using ResidentialManagement.Api.Middleware;

namespace ResidentialManagement.Api.UnitTests.Services;

public sealed class ExceptionLoggingTests
{
    [Theory]
    [InlineData("bad", 400, LogLevel.Information)]
    [InlineData("missing", 404, LogLevel.Information)]
    [InlineData("conflict", 409, LogLevel.Information)]
    [InlineData("unauthorized", 401, LogLevel.Warning)]
    [InlineData("forbidden", 403, LogLevel.Warning)]
    [InlineData("provider", 503, LogLevel.Warning)]
    [InlineData("unexpected", 500, LogLevel.Error)]
    [InlineData("cancelled", 200, LogLevel.Debug)]
    public async Task Expected_log_levels_and_safe_error_responses_are_preserved(string kind, int status, LogLevel level)
    {
        Exception error = kind switch
        {
            "bad" => new BadRequestException("validation"),
            "missing" => new NotFoundException("missing"),
            "conflict" => new ConflictException("conflict"),
            "unauthorized" => new UnauthorizedException("unauthorized"),
            "forbidden" => new ForbiddenException("forbidden"),
            "provider" => new AiUnavailableException(),
            "cancelled" => new OperationCanceledException(),
            _ => new Exception("private internal detail")
        };
        var context = new DefaultHttpContext();
        using var body = new MemoryStream();
        context.Response.Body = body;
        if (kind == "cancelled") context.RequestAborted = new CancellationToken(true);
        var logger = new RecordingLogger();
        var middleware = new ExceptionHandlingMiddleware(_ => Task.FromException(error), logger,
            new HostingEnvironment { EnvironmentName = "Production" });
        await middleware.InvokeAsync(context);
        Assert.Equal(status, context.Response.StatusCode);
        Assert.Equal(level, logger.Level);
        Assert.Equal(kind == "unexpected", logger.HasException);
        body.Position = 0;
        var response = await new StreamReader(body).ReadToEndAsync();
        Assert.DoesNotContain("private internal detail", response);
        if (kind == "cancelled") Assert.Empty(response);
    }

    private sealed class RecordingLogger : ILogger<ExceptionHandlingMiddleware>
    {
        public LogLevel Level { get; private set; }
        public bool HasException { get; private set; }
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        { Level = logLevel; HasException = exception is not null; }
    }
}
