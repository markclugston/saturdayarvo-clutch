using Clutch.API.Domain.Assets;

namespace Clutch.API.Tests.Unit.Assets;

public sealed class AssetValidatorTests
{
    private static readonly TimeProvider Clock =
        new FixedTimeProvider(new DateTimeOffset(2026, 11, 27, 12, 0, 0, TimeSpan.Zero));

    [Fact]
    public void A_valid_asset_is_trimmed_and_typed()
    {
        var result = Validate(Candidate(
            name: "  House  ",
            description: "  Family home  ",
            valuations: [new ValuationCandidate(null, 12000.5m, "2026-01-01")]));

        Assert.Empty(result.Errors);
        var asset = result.Value!;
        Assert.Equal("House", asset.Name);
        Assert.Equal("Family home", asset.Description);
        Assert.Equal("AUD", asset.Currency.Code);
        var valuation = Assert.Single(asset.Valuations);
        Assert.Null(valuation.Id);
        Assert.Equal(12000.5m, valuation.Value);
        Assert.Equal(new DateOnly(2026, 1, 1), valuation.ValuationDate);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_blank_description_becomes_null(string? description) =>
        Assert.Null(Validate(Candidate(description: description)).Value!.Description);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_name_is_required(string? name) =>
        AssertError(Candidate(name: name), "name", "Enter a name");

    [Fact]
    public void A_name_is_limited_to_100_characters_after_trimming()
    {
        Assert.Empty(Validate(Candidate(name: $"  {new string('n', 100)}  ")).Errors);
        AssertError(Candidate(name: new string('n', 101)), "name", "Enter a name of up to 100 characters");
    }

    [Fact]
    public void A_description_is_limited_to_500_characters()
    {
        Assert.Empty(Validate(Candidate(description: new string('d', 500))).Errors);
        AssertError(
            Candidate(description: new string('d', 501)),
            "description",
            "Enter a description of up to 500 characters");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("XXX")]
    [InlineData("aud")]
    public void A_supported_currency_is_required(string? currencyCode) =>
        AssertError(Candidate(currencyCode: currencyCode), "currencyCode", "Select a currency");

    [Fact]
    public void At_least_one_valuation_is_required() =>
        AssertError(Candidate(valuations: []), "valuations", "Add at least one valuation");

    [Fact]
    public void A_value_is_required() =>
        AssertValueError(null, "AUD", "Enter a value");

    [Fact]
    public void A_negative_value_is_rejected_and_zero_is_accepted()
    {
        AssertValueError(-0.01m, "AUD", "Enter a value of 0 or more");
        Assert.Empty(Validate(Candidate(valuations: [new(null, 0m, "2026-01-01")])).Errors);
    }

    [Fact]
    public void The_cap_is_accepted_and_one_cent_more_is_rejected()
    {
        Assert.Empty(Validate(Candidate(valuations: [new(null, 999_999_999_999.99m, "2026-01-01")])).Errors);
        AssertValueError(1_000_000_000_000.00m, "AUD", "Enter a value up to 999,999,999,999.99");
    }

    [Fact]
    public void Decimals_are_limited_to_the_currency_minor_units()
    {
        Assert.Empty(Validate(Candidate(valuations: [new(null, 1.25m, "2026-01-01")])).Errors);
        Assert.Empty(Validate(Candidate(valuations: [new(null, 1.2500m, "2026-01-01")])).Errors);
        AssertValueError(1.255m, "AUD", "Enter at most 2 decimal places");
        AssertValueError(5000.5m, "JPY", "JPY values have no decimal places");
        Assert.Empty(Validate(Candidate(
            currencyCode: "JPY",
            valuations: [new(null, 5000.00m, "2026-01-01")])).Errors);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("01/01/2026")]
    [InlineData("2026-02-30")]
    public void A_valid_valuation_date_is_required(string? date) =>
        AssertError(
            Candidate(valuations: [new(null, 1m, date)]),
            "valuations[0].valuationDate",
            "Enter a valid date");

    [Fact]
    public void A_date_is_not_in_the_future_anywhere_in_the_world()
    {
        // 12:00 UTC on 27 Nov is already 28 Nov at UTC+14.
        Assert.Empty(Validate(Candidate(valuations: [new(null, 1m, "2026-11-28")])).Errors);
        AssertError(
            Candidate(valuations: [new(null, 1m, "2026-11-29")]),
            "valuations[0].valuationDate",
            "Enter a date that is not in the future");
    }

    [Fact]
    public void Valuation_dates_are_unique_within_the_asset()
    {
        var result = Validate(Candidate(valuations:
        [
            new(null, 1m, "2026-01-01"),
            new(null, 2m, "2026-02-01"),
            new(null, 3m, "2026-01-01"),
        ]));

        Assert.Equal(
            ["valuations[0].valuationDate", "valuations[2].valuationDate"],
            result.Errors.Keys.Order(StringComparer.Ordinal));
        Assert.All(result.Errors.Values, message => Assert.Equal("This valuation date is already used", message));
        Assert.Null(result.Value);
    }

    [Fact]
    public void A_valuation_id_is_parsed_and_an_invalid_one_is_a_field_error()
    {
        var id = Guid.NewGuid();
        Assert.Equal(id, Validate(Candidate(valuations: [new(id.ToString(), 1m, "2026-01-01")]))
            .Value!.Valuations[0].Id);
        AssertError(
            Candidate(valuations: [new("not-an-id", 1m, "2026-01-01")]),
            "valuations[0].id",
            AssetValidator.UnknownValuationMessage);
    }

    [Fact]
    public void Every_failing_field_is_reported_together()
    {
        var result = Validate(new AssetCandidate(
            null,
            new string('d', 501),
            null,
            [new(null, -1m, null)]));

        Assert.Equal(
            ["currencyCode", "description", "name", "valuations[0].valuationDate", "valuations[0].value"],
            result.Errors.Keys.Order(StringComparer.Ordinal));
    }

    private static AssetCandidate Candidate(
        string? name = "House",
        string? description = null,
        string? currencyCode = "AUD",
        IReadOnlyList<ValuationCandidate>? valuations = null) =>
        new(name, description, currencyCode, valuations ?? [new(null, 100m, "2026-01-01")]);

    private static AssetValidationResult Validate(AssetCandidate candidate) =>
        AssetValidator.Validate(candidate, Clock);

    private static void AssertError(AssetCandidate candidate, string field, string message)
    {
        var result = Validate(candidate);
        Assert.Null(result.Value);
        var error = Assert.Single(result.Errors);
        Assert.Equal(field, error.Key);
        Assert.Equal(message, error.Value);
    }

    private static void AssertValueError(decimal? value, string currencyCode, string message) =>
        AssertError(
            Candidate(currencyCode: currencyCode, valuations: [new(null, value, "2026-01-01")]),
            "valuations[0].value",
            message);

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
