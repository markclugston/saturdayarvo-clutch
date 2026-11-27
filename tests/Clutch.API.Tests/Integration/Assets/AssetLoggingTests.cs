using System.Net;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using static Clutch.API.Tests.Integration.Assets.AssetTestSupport;

namespace Clutch.API.Tests.Integration.Assets;

[Collection(SqlServerCollection.Name)]
public sealed class AssetLoggingTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Logs_carry_asset_ids_and_never_names_descriptions_or_values()
    {
        var provider = new CapturingLoggerProvider();
        using var factory = fixture.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.AddSingleton<ILoggerProvider>(provider)));
        using var client = await SignedInClientAsync(factory);

        // Distinctive text and numbers so any leak is unmistakable.
        const decimal value = 7654321.09m;
        var created = await CreateAsync(client, Body("Quokka Manor", "Wombat description", valuations: [Valuation(value)]));
        using var invalid = await SendAsync(client, HttpMethod.Post, "/api/assets", Body(
            "Quokka Manor", new string('w', 501), valuations: [Valuation(value)]));
        var lease = await LeaseAsync(client, created.Id);
        using var blocked = await AcquireAsync(client, created.Id);
        using var refusedDelete = await DeleteAsync(client, created.Id);
        (await StatusAsync(client, created.Id, lease.EditId)).ToString();
        using var save = await SaveAsync(client, created.Id, Body(
            "Numbat Lodge",
            "Wombat description",
            valuations: [Valuation(created.Valuations[0]), Valuation(8765432.1m, "2026-02-01")],
            editId: lease.EditId));
        var second = await LeaseAsync(client, created.Id);
        using var end = await EndAsync(client, created.Id, second.EditId);
        using var stale = await SaveAsync(client, created.Id, Body("Numbat Lodge", editId: second.EditId));
        var third = await LeaseAsync(client, created.Id);
        using var release = await ReleaseAsync(client, created.Id, third.EditId);
        using var delete = await DeleteAsync(client, created.Id);

        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, refusedDelete.StatusCode);
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, end.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, release.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var assetLogs = provider.Entries
            .Where(entry => entry.Category.StartsWith("Clutch.API.Application.Assets", StringComparison.Ordinal))
            .ToList();
        Assert.True(assetLogs.Count >= 8);
        Assert.All(assetLogs, entry => Assert.DoesNotContain("@example.test", entry.Text));
        Assert.Contains(assetLogs, entry => entry.Text.Contains(created.Id.ToString()));
        Assert.All(provider.Entries, entry =>
        {
            Assert.DoesNotContain("Quokka", entry.Text);
            Assert.DoesNotContain("Numbat", entry.Text);
            Assert.DoesNotContain("Wombat", entry.Text);
            Assert.DoesNotContain("7654321", entry.Text);
            Assert.DoesNotContain("8765432", entry.Text);
        });
    }
}
