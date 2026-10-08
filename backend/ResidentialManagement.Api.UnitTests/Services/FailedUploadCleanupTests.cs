using Microsoft.Extensions.Logging.Abstractions;
using ResidentialManagement.Api.Services;

namespace ResidentialManagement.Api.UnitTests.Services;

public sealed class FailedUploadCleanupTests
{
    [Fact]
    public void Cleanup_failure_does_not_mask_primary_exception()
    {
        var primary = new InvalidOperationException("primary");
        var caught = Assert.Throws<InvalidOperationException>((Action)(() =>
        {
            try { throw primary; }
            catch
            {
                FailedUploadCleanup.Run(() => throw new IOException("cleanup failed"), NullLogger.Instance);
                throw;
            }
        }));
        Assert.Same(primary, caught);
    }
}
