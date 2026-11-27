using Clutch.API.Domain.Assets;

namespace Clutch.API.Tests.Unit.Assets;

public sealed class AssetAuditTextTests
{
    private static readonly Guid AssetId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid EditId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Fact]
    public void Created_lists_the_id_name_description_currency_and_each_valuation()
    {
        var text = AssetAuditText.Created(
            AssetId,
            new AssetAuditDetails("House", "Family home", "AUD"),
            [Valuation(12000m, 2026, 1, 1), Valuation(10000.5m, 2025, 1, 31)]);

        Assert.Equal(
            $"Asset {AssetId} was created. Name: House. Description: Family home. Currency: AUD. "
            + "Valuations added: 12000.00 AUD on 2026-01-01; 10000.50 AUD on 2025-01-31.",
            text);
    }

    [Fact]
    public void Created_omits_a_missing_description_and_formats_without_decimals_for_yen()
    {
        var text = AssetAuditText.Created(
            AssetId,
            new AssetAuditDetails("Bond", null, "JPY"),
            [Valuation(5000.00m, 2026, 1, 1)]);

        Assert.DoesNotContain("Description", text, StringComparison.Ordinal);
        Assert.Contains("Currency: JPY.", text, StringComparison.Ordinal);
        Assert.Contains("5000 JPY on 2026-01-01", text, StringComparison.Ordinal);
    }

    [Fact]
    public void Updated_lists_old_and_new_values_that_changed_and_each_valuation_added_and_removed()
    {
        var text = AssetAuditText.Updated(
            AssetId,
            new AssetAuditDetails("House", "Old", "AUD"),
            new AssetAuditDetails("Home", null, "AUD"),
            [Valuation(900m, 2026, 3, 1)],
            [Valuation(10000.25m, 2025, 1, 1)]);

        Assert.Equal(
            $"Asset {AssetId} was updated. Name changed from House to Home. "
            + "Description changed from Old to (none). "
            + "Valuations added: 900.00 AUD on 2026-03-01. Valuations removed: 10000.25 AUD on 2025-01-01.",
            text);
    }

    [Fact]
    public void Updated_leaves_out_everything_that_did_not_change()
    {
        var details = new AssetAuditDetails("House", "Same", "AUD");

        var text = AssetAuditText.Updated(AssetId, details, details, [], []);

        Assert.Equal($"Asset {AssetId} was updated.", text);
    }

    [Fact]
    public void Updated_reports_a_new_description_where_there_was_none()
    {
        var text = AssetAuditText.Updated(
            AssetId,
            new AssetAuditDetails("House", null, "AUD"),
            new AssetAuditDetails("House", "Added", "AUD"),
            [],
            []);

        Assert.Equal($"Asset {AssetId} was updated. Description changed from (none) to Added.", text);
    }

    [Fact]
    public void Deleted_lists_the_currency_and_every_removed_valuation()
    {
        var text = AssetAuditText.Deleted(
            AssetId,
            new AssetAuditDetails("House", "Family home", "AUD"),
            [Valuation(2m, 2026, 1, 1), Valuation(1m, 2025, 1, 1)]);

        Assert.Equal(
            $"Asset {AssetId} was deleted. Name: House. Description: Family home. Currency: AUD. "
            + "Valuations removed: 2.00 AUD on 2026-01-01; 1.00 AUD on 2025-01-01.",
            text);
    }

    [Fact]
    public void A_rejected_edit_names_the_asset_rejected_user_and_active_edit()
    {
        var text = AssetAuditText.EditRejected(AssetId, "user-2", EditId);

        Assert.Equal(
            $"An edit of asset {AssetId} by user user-2 was rejected because edit {EditId} is active.",
            text);
    }

    [Fact]
    public void An_ended_edit_names_the_asset_edit_and_ender()
    {
        var text = AssetAuditText.EditEnded(AssetId, EditId, "user-3");

        Assert.Equal($"Edit {EditId} of asset {AssetId} was ended by user user-3.", text);
    }

    [Fact]
    public void A_long_history_is_never_truncated()
    {
        var valuations = Enumerable.Range(0, 200)
            .Select(day => new AssetAuditValuation(1m, new DateOnly(2020, 1, 1).AddDays(day)))
            .ToList();

        var text = AssetAuditText.Created(AssetId, new AssetAuditDetails("Many", null, "AUD"), valuations);

        Assert.True(text.Length > 500);
        Assert.Contains("2020-07-18", text, StringComparison.Ordinal);
    }

    private static AssetAuditValuation Valuation(decimal value, int year, int month, int day) =>
        new(value, new DateOnly(year, month, day));
}
