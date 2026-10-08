namespace ResidentialManagement.Api.IntegrationTests.Infrastructure;

[Collection(IntegrationTestCollection.Name)]
public abstract class IntegrationTestBase : IAsyncLifetime
{
    protected IntegrationTestBase(IntegrationTestFixture fixture) => Fixture = fixture;

    protected IntegrationTestFixture Fixture { get; }
    protected TestDataIds Data => Fixture.Data;

    public Task InitializeAsync() => Fixture.ResetAndSeedAsync();

    public Task DisposeAsync() => Task.CompletedTask;
}
