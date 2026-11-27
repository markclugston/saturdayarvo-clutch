using System.Net;
using System.Net.Http.Json;
using System.Text;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.EntityFrameworkCore;
using static Clutch.API.Tests.Integration.Assets.AssetTestSupport;

namespace Clutch.API.Tests.Integration.Assets;

[Collection(SqlServerCollection.Name)]
public sealed class AssetCreateTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Create_stores_the_asset_with_its_valuations_and_one_audit_row()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        using var response = await SendAsync(client, HttpMethod.Post, "/api/assets", Body(
            "  Bond  ",
            "Held in Tokyo",
            "JPY",
            [Valuation(4000m, "2025-01-01"), Valuation(5000m, "2026-01-01")]));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = (await response.Content.ReadFromJsonAsync<DetailDto>())!;
        Assert.Equal($"/api/assets/{created.Id}", response.Headers.Location!.ToString());
        Assert.Equal("Bond", created.Name);
        Assert.Equal("JPY", created.CurrencyCode);
        Assert.Equal(["2026-01-01", "2025-01-01"], created.Valuations.Select(item => item.ValuationDate));
        var listed = Assert.Single((await ListAsync(client)).Assets);
        Assert.Equal("JPY", listed.CurrencyCode);
        Assert.Equal(new LatestDto(5000m, "2026-01-01"), listed.LatestValuation);

        var audit = Assert.Single(await AuditsAsync(fixture, created.Id));
        Assert.Equal("AssetCreate", audit.EventCode);
        Assert.Contains("Name: Bond.", audit.Description, StringComparison.Ordinal);
        Assert.Contains("Currency: JPY.", audit.Description, StringComparison.Ordinal);
        Assert.Contains("5000 JPY on 2026-01-01", audit.Description, StringComparison.Ordinal);
        Assert.Contains("4000 JPY on 2025-01-01", audit.Description, StringComparison.Ordinal);
    }

    public static TheoryData<string, object> InvalidBodies => new()
    {
        { "name", Body(name: " ") },
        { "name", Body(name: new string('n', 101)) },
        { "description", Body(description: new string('d', 501)) },
        { "currencyCode", Body(currencyCode: null) },
        { "currencyCode", Body(currencyCode: "XXX") },
        { "valuations", Body(valuations: []) },
        { "valuations[0].value", Body(valuations: [new { valuationDate = "2026-01-01" }]) },
        { "valuations[0].value", Body(valuations: [new { value = "100", valuationDate = "2026-01-01" }]) },
        { "valuations[0].value", Body(valuations: [Valuation(-1m)]) },
        { "valuations[0].value", Body(valuations: [Valuation(1_000_000_000_000m)]) },
        { "valuations[0].value", Body(valuations: [Valuation(1.001m)]) },
        { "valuations[0].value", Body(currencyCode: "JPY", valuations: [Valuation(1.5m)]) },
        { "valuations[0].value", Body(valuations: [null!]) },
        { "valuations[0].valuationDate", Body(valuations: [Valuation(1m, "not-a-date")]) },
        { "valuations[0].valuationDate", Body(valuations: [Valuation(1m, "9999-01-01")]) },
        { "valuations[1].valuationDate", Body(valuations: [Valuation(1m), Valuation(2m)]) },
        { "valuations[0].id", Body(valuations: [Valuation(1m, "2026-01-01", Guid.NewGuid())]) },
    };

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    [Trait("Category", "SqlServer")]
    public async Task Invalid_input_is_a_field_error_and_stores_nothing(string field, object body)
    {
        using var client = await SignedInClientAsync(fixture.Factory);

        using var response = await SendAsync(client, HttpMethod.Post, "/api/assets", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ProblemAsync(response);
        Assert.Contains(field, problem.Errors!.Keys);
        Assert.Empty((await ListAsync(client)).Assets);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_body_over_64_kb_is_rejected_and_stores_nothing()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var body = Body(description: new string('d', 70 * 1024));

        using var declared = await SendAsync(client, HttpMethod.Post, "/api/assets", body);
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        var token = (await JsonAsync(tokenResponse)).GetProperty("requestToken").GetString();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/assets")
        {
            Content = new StreamContent(new UnknownLengthStream(Encoding.UTF8.GetBytes(
                System.Text.Json.JsonSerializer.Serialize(body)))),
        };
        request.Content.Headers.ContentType = new("application/json");
        request.Headers.Add("X-CSRF-TOKEN", token);
        using var undeclared = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, declared.StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, undeclared.StatusCode);
        Assert.Empty((await ListAsync(client)).Assets);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Create_requires_a_signed_in_user_and_an_antiforgery_token()
    {
        using var anonymous = CreateClient(fixture.Factory);
        using var unauthorized = await SendAsync(anonymous, HttpMethod.Post, "/api/assets", Body());
        using var client = await SignedInClientAsync(fixture.Factory);
        using var forged = await SendAsync(client, HttpMethod.Post, "/api/assets", Body(), withCsrf: false);

        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, forged.StatusCode);
        Assert.Empty((await ListAsync(client)).Assets);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_failed_write_stores_no_asset_valuation_or_audit_row()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var marker = $"Rollback {Guid.NewGuid():N}";
        // The audit insert fails, after the asset insert in the same transaction.
        await QueryAsync(fixture, db => db.Database.ExecuteSqlRawAsync(
            "CREATE TRIGGER TR_Test_FailAssetAudit ON Audit AFTER INSERT AS "
            + "IF EXISTS (SELECT 1 FROM inserted WHERE [Description] LIKE '%Rollback %') "
            + "THROW 50001, 'Test failure', 1;"));
        try
        {
            using var response = await SendAsync(client, HttpMethod.Post, "/api/assets", Body(marker));

            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        }
        finally
        {
            await QueryAsync(fixture, db => db.Database.ExecuteSqlRawAsync("DROP TRIGGER TR_Test_FailAssetAudit"));
        }

        Assert.Empty((await ListAsync(client)).Assets);
        Assert.False(await QueryAsync(fixture, db => db.Assets.AnyAsync(asset => asset.Name == marker)));
        Assert.False(await QueryAsync(fixture, db => db.Audits.AnyAsync(audit => audit.Description.Contains(marker))));
    }

    private sealed class UnknownLengthStream(byte[] data) : MemoryStream(data)
    {
        public override bool CanSeek => false;
    }
}
