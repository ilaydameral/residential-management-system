namespace ResidentialManagement.Api.Services;

public static class FailedUploadCleanup
{
    // Cleanup must never hide the primary persistence/write error. Never log paths or file content.
    public static void Run(Func<bool> delete, ILogger logger)
    {
        try
        {
            if (!delete()) logger.LogWarning("Failed upload file could not be removed.");
        }
        catch { logger.LogWarning("Failed upload file cleanup failed."); }
    }
}
