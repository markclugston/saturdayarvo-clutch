using System.Net;
using System.Net.Http.Json;
using Clutch.API.Domain.Assets;
using Clutch.API.Tests.Integration.Accounts;
using static Clutch.API.Tests.Integration.Assets.AssetTestSupport;

namespace Clutch.API.Tests.Integration.Assets;

[Collection(SqlServerCollection.Name)]
public sealed class AssetUpdateTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Save_stores_the_name_added_and_removed_valuations_together_and_audits_them()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Old name", "Old words", valuations:
        [
            Valuation(100m, "2024-01-01"),
            Valuation(200m, "2025-01-01"),
        ]));
        var kept = created.Valuations.Single(item => item.ValuationDate == "2025-01-01");
        var lease = await LeaseAsync(client, created.Id);

        using var response = await SaveAsync(client, created.Id, Body(
            "New name",
            valuations:
            [
                Valuation(kept),
                Valuation(150m, "2024-01-01"),
                Valuation(300m, "2026-01-01"),
            ],
            editId: lease.EditId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = (await response.Content.ReadFromJsonAsync<DetailDto>())!;
        Assert.Equal("New name", saved.Name);
        Assert.Null(saved.Description);
        Assert.Equal(
            ["2026-01-01", "2025-01-01", "2024-01-01"],
            saved.Valuations.Select(item => item.ValuationDate));
        Assert.Equal(kept.Id, saved.Valuations[1].Id);
        Assert.Equal(150m, saved.Valuations[2].Value);
        Assert.Equal(new LatestDto(300m, "2026-01-01"), (await ListAsync(client)).Assets[0].LatestValuation);
        Assert.Equal(AssetEditState.Saved, (await EditAsync(fixture, lease.EditId)).State);
        Assert.Null(await ActiveEditIdAsync(fixture, created.Id));

        var audit = Assert.Single(await AuditsAsync(fixture, created.Id), row => row.EventCode == "AssetUpdate");
        Assert.Contains("Name changed from Old name to New name.", audit.Description, StringComparison.Ordinal);
        Assert.Contains("Description changed from Old words to (none).", audit.Description, StringComparison.Ordinal);
        Assert.Contains("300.00 AUD on 2026-01-01", audit.Description, StringComparison.Ordinal);
        Assert.Contains("Valuations removed: 100.00 AUD on 2024-01-01.", audit.Description, StringComparison.Ordinal);
        Assert.DoesNotContain("200.00", audit.Description, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("USD")]
    [InlineData("JPY")]
    [Trait("Category", "SqlServer")]
    public async Task A_saved_assets_currency_cannot_be_changed(string currencyCode)
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Unchanged", valuations: [Valuation(5000m)]));
        var lease = await LeaseAsync(client, created.Id);

        using var response = await SaveAsync(client, created.Id, Body(
            "Renamed",
            currencyCode: currencyCode,
            valuations: [Valuation(created.Valuations[0])],
            editId: lease.EditId));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            ["The currency cannot be changed"],
            (await ProblemAsync(response)).Errors!["currencyCode"]);
        var listed = Assert.Single((await ListAsync(client)).Assets);
        Assert.Equal("Unchanged", listed.Name);
        Assert.Equal("AUD", listed.CurrencyCode);
        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
        Assert.Equal(lease.EditId, await ActiveEditIdAsync(fixture, created.Id));
        Assert.Single(await AuditsAsync(fixture, created.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_description_longer_than_500_characters_is_audited_in_full()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body(description: new string('a', 500)));
        var lease = await LeaseAsync(client, created.Id);

        using var response = await SaveAsync(client, created.Id, Body(
            description: new string('b', 500),
            valuations: [Valuation(created.Valuations[0])],
            editId: lease.EditId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var audit = Assert.Single(await AuditsAsync(fixture, created.Id), row => row.EventCode == "AssetUpdate");
        Assert.Contains(new string('a', 500), audit.Description, StringComparison.Ordinal);
        Assert.Contains(new string('b', 500), audit.Description, StringComparison.Ordinal);
    }

    public static TheoryData<string, string?, string?, string?, decimal?, string?> InvalidFields => new()
    {
        { "name", " ", null, "AUD", 100m, "2026-01-01" },
        { "description", "House", new string('d', 501), "AUD", 100m, "2026-01-01" },
        { "currencyCode", "House", null, "XXX", 100m, "2026-01-01" },
        { "valuations[0].value", "House", null, "AUD", -1m, "2026-01-01" },
        { "valuations[0].value", "House", null, "AUD", 1.001m, "2026-01-01" },
        { "valuations[0].valuationDate", "House", null, "AUD", 100m, "9999-01-01" },
    };

    [Theory]
    [MemberData(nameof(InvalidFields))]
    [Trait("Category", "SqlServer")]
    public async Task Invalid_input_is_a_field_error_before_the_edit_is_claimed(
        string field,
        string? name,
        string? description,
        string? currencyCode,
        decimal? value,
        string? date)
    {
        await AssertRejectedAsync(field, (_, editId) => Body(
            name,
            description,
            currencyCode,
            [Valuation(value!.Value, date!)],
            editId));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task No_valuations_is_a_field_error() =>
        await AssertRejectedAsync("valuations", (_, editId) => Body(valuations: [], editId: editId));

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task An_unknown_valuation_id_is_a_field_error() =>
        await AssertRejectedAsync(
            "valuations[0].id",
            (_, editId) => Body(valuations: [Valuation(100m, "2026-01-01", Guid.NewGuid())], editId: editId));

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Another_assets_valuation_id_is_a_field_error()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var mine = await CreateAsync(client, Body("Mine"));
        var other = await CreateAsync(client, Body("Other"));
        var lease = await LeaseAsync(client, mine.Id);

        using var response = await SaveAsync(client, mine.Id, Body(
            valuations: [Valuation(other.Valuations[0])],
            editId: lease.EditId));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("valuations[0].id", (await ProblemAsync(response)).Errors!.Keys);
        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_missing_edit_id_is_a_field_error() =>
        await AssertRejectedAsync("editId", (asset, _) => Body(valuations: [Valuation(asset.Valuations[0])]));

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_failed_write_stores_nothing_and_leaves_the_edit_active()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Before"));
        var lease = await LeaseAsync(client, created.Id);
        var marker = $"Failing {Guid.NewGuid():N}";
        await QueryAsync(fixture, db => Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions.ExecuteSqlRawAsync(
            db.Database,
            "CREATE TRIGGER TR_Test_FailAssetUpdateAudit ON Audit AFTER INSERT AS "
            + "IF EXISTS (SELECT 1 FROM inserted WHERE [Description] LIKE '%Failing %') "
            + "THROW 50001, 'Test failure', 1;"));
        try
        {
            using var response = await SaveAsync(client, created.Id, Body(
                marker,
                valuations: [Valuation(500m, "2026-05-01")],
                editId: lease.EditId));

            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        }
        finally
        {
            await QueryAsync(fixture, db => Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions.ExecuteSqlRawAsync(
                db.Database,
                "DROP TRIGGER TR_Test_FailAssetUpdateAudit"));
        }

        var listed = Assert.Single((await ListAsync(client)).Assets);
        Assert.Equal("Before", listed.Name);
        Assert.Equal(new LatestDto(100m, "2026-01-01"), listed.LatestValuation);
        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
        Assert.Equal(lease.EditId, await ActiveEditIdAsync(fixture, created.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_deleted_or_foreign_asset_is_not_found()
    {
        using var owner = await SignedInClientAsync(fixture.Factory);
        using var other = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(owner, Body("Mine"));
        var lease = await LeaseAsync(owner, created.Id);

        using var foreign = await SaveAsync(other, created.Id, Body("Stolen", editId: lease.EditId));
        await AssertCodeAsync(foreign, HttpStatusCode.NotFound, "AssetNotFound");
        Assert.Equal("Mine", Assert.Single((await ListAsync(owner)).Assets).Name);

        using (var release = await ReleaseAsync(owner, created.Id, lease.EditId))
        using (var delete = await DeleteAsync(owner, created.Id))
        {
            Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        }

        using var gone = await SaveAsync(owner, created.Id, Body("Gone", editId: lease.EditId));
        await AssertCodeAsync(gone, HttpStatusCode.NotFound, "AssetNotFound");
    }

    private async Task AssertRejectedAsync(
        string field,
        Func<DetailDto, Guid, object> body)
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Unchanged", valuations: [Valuation(100m)]));
        var lease = await LeaseAsync(client, created.Id);

        using var response = await SaveAsync(client, created.Id, body(created, lease.EditId));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(field, (await ProblemAsync(response)).Errors!.Keys);
        var listed = Assert.Single((await ListAsync(client)).Assets);
        Assert.Equal("Unchanged", listed.Name);
        Assert.Equal("AUD", listed.CurrencyCode);
        Assert.Equal(new LatestDto(100m, "2026-01-01"), listed.LatestValuation);
        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
        Assert.Single(await AuditsAsync(fixture, created.Id));
    }
}
