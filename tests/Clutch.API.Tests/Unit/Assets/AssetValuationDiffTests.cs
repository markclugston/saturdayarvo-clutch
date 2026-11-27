using Clutch.API.Domain.Assets;

namespace Clutch.API.Tests.Unit.Assets;

public sealed class AssetValuationDiffTests
{
    private static readonly Guid AssetId = Guid.NewGuid();
    private static readonly AssetValuation Older = new(AssetId, 100m, new DateOnly(2025, 1, 1));
    private static readonly AssetValuation Newer = new(AssetId, 200.50m, new DateOnly(2026, 1, 1));

    [Fact]
    public void New_items_are_added_missing_ones_removed_and_kept_ones_left_alone()
    {
        var added = new ValidValuation(null, 300m, new DateOnly(2026, 6, 1));

        var diff = Compare(Kept(Newer), added);

        Assert.Empty(diff.Errors);
        Assert.Equal([added], diff.Added);
        Assert.Equal([Older], diff.Removed);
    }

    [Fact]
    public void An_unchanged_set_has_nothing_to_add_or_remove()
    {
        var diff = Compare(Kept(Newer), new ValidValuation(Older.Id, 100.00m, Older.ValuationDate));

        Assert.Empty(diff.Errors);
        Assert.Empty(diff.Added);
        Assert.Empty(diff.Removed);
    }

    [Fact]
    public void A_removed_date_can_be_added_again()
    {
        var replacement = new ValidValuation(null, 5m, Older.ValuationDate);

        var diff = Compare(Kept(Newer), replacement);

        Assert.Equal([replacement], diff.Added);
        Assert.Equal([Older], diff.Removed);
    }

    [Fact]
    public void An_unknown_or_foreign_id_is_a_field_error_at_its_position()
    {
        var foreign = new ValidValuation(Guid.NewGuid(), 1m, new DateOnly(2024, 1, 1));

        var diff = Compare(Kept(Newer), foreign);

        var error = Assert.Single(diff.Errors);
        Assert.Equal("valuations[1].id", error.Key);
        Assert.Equal(AssetValidator.UnknownValuationMessage, error.Value);
    }

    [Fact]
    public void A_repeated_id_is_a_field_error()
    {
        var diff = Compare(Kept(Newer), Kept(Newer));

        Assert.Equal(["valuations[1].id"], diff.Errors.Keys);
    }

    [Theory]
    [InlineData(201, "2026-01-01")]
    [InlineData(200.50, "2026-01-02")]
    public void A_stored_valuation_cannot_be_changed_in_place(double value, string date)
    {
        var diff = Compare(new ValidValuation(Newer.Id, (decimal)value, DateOnly.Parse(date, System.Globalization.CultureInfo.InvariantCulture)));

        var error = Assert.Single(diff.Errors);
        Assert.Equal("valuations[0].id", error.Key);
        Assert.Equal(AssetValuationDiff.ChangedValuationMessage, error.Value);
    }

    private static ValidValuation Kept(AssetValuation valuation) =>
        new(valuation.Id, valuation.Value, valuation.ValuationDate);

    private static AssetValuationDiff Compare(params ValidValuation[] desired) =>
        AssetValuationDiff.Compare([Older, Newer], desired);
}
