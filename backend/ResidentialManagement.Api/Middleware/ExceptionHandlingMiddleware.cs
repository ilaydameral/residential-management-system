using System.Net;
using System.Text.Json;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            _logger.LogDebug("Request was cancelled by the client. Path={Path}", context.Request.Path);
        }
        catch (Exception ex)
        {
            if (ex is UnauthorizedException or ForbiddenException)
            {
                _logger.LogWarning(
                    "Request authorization was rejected. Path={Path} ErrorType={ErrorType}",
                    context.Request.Path,
                    ex.GetType().Name);
            }
            else if (ex is BadRequestException or ConflictException or InvalidOperationException or
                     NotFoundException or KeyNotFoundException)
            {
                _logger.LogInformation(
                    "Request was rejected by a domain rule. Path={Path} ErrorType={ErrorType}",
                    context.Request.Path,
                    ex.GetType().Name);
            }
            else if (ex is AiUnavailableException or AiModelUnavailableException or AiTimeoutException or AiRateLimitException)
            {
                _logger.LogWarning("Optional AI operation is unavailable. ErrorType={ErrorType}", ex.GetType().Name);
            }
            else if (ex is AiInvalidResponseException)
            {
                _logger.LogWarning("Optional AI operation returned an invalid response.");
            }
            else
            {
                _logger.LogError(ex, "An unhandled exception occurred: {Message}", ex.Message);
            }
            await HandleExceptionAsync(context, ex);
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var statusCode = exception switch
        {
            UnauthorizedException => (int)HttpStatusCode.Unauthorized,
            ForbiddenException => (int)HttpStatusCode.Forbidden,
            BadRequestException => (int)HttpStatusCode.BadRequest,
            ConflictException => (int)HttpStatusCode.Conflict,
            InvalidOperationException => (int)HttpStatusCode.Conflict,
            NotFoundException => (int)HttpStatusCode.NotFound,
            KeyNotFoundException => (int)HttpStatusCode.NotFound,
            AiUnavailableException => (int)HttpStatusCode.ServiceUnavailable,
            AiModelUnavailableException => (int)HttpStatusCode.ServiceUnavailable,
            AiInvalidResponseException => (int)HttpStatusCode.BadGateway,
            AiTimeoutException => (int)HttpStatusCode.GatewayTimeout,
            AiRateLimitException => (int)HttpStatusCode.TooManyRequests,
            _ => (int)HttpStatusCode.InternalServerError
        };

        context.Response.StatusCode = statusCode;

        var response = new ErrorResponse
        {
            StatusCode = statusCode,
            Message = statusCode != (int)HttpStatusCode.InternalServerError ? exception.Message : "Sunucuda beklenmeyen bir hata oluştu.",
            Details = _env.IsDevelopment() ? exception.Message : null,
            Timestamp = DateTime.UtcNow
        };

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        var json = JsonSerializer.Serialize(response, jsonOptions);
        return context.Response.WriteAsync(json);
    }
}
