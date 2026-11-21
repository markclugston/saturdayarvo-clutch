using System.Globalization;
using Clutch.API.Domain.Mortgages;

namespace Clutch.API.Tests.Unit.Mortgages;

public sealed class MortgageValidatorTests
{
    private static readonly TimeProvider Clock = new FixedTimeProvider(
        new DateTimeOffset(2026, 6, 15, 12, 0, 0, TimeSpan.Zero));

    private static MortgageCandidate Valid(
        string? name = "Home loan",
        decimal? balance = 500_000m,
        decimal? periods = 360m,
        string? first = "2000-01-01",
        string? frequency = "Monthly",
        params RateChangeCandidate[] rows) =>
        new(
            name,
            balance,
            periods,
            first,
            frequency,
            rows.Length == 0 ? [new RateChangeCandidate(5m, "2000-01-01")] : rows);

    private static IReadOnlyDictionary<string, string> Errors(MortgageCandidate candidate) =>
        MortgageValidator.Validate(candidate, Clock).Errors;

    [Fact]
    public void A_valid_mortgage_has_no_errors_and_a_trimmed_name()
    {
        var result = MortgageValidator.Validate(Valid(name: "  Home loan  "), Clock);

        Assert.Empty(result.Errors);
        Assert.Equal("Home loan", result.Value!.Name);
        Assert.Equal(360, result.Value.Duration);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Blank_name_is_rejected(string? name) =>
        Assert.Equal("Enter a name", Errors(Valid(name: name))["name"]);

    [Fact]
    public void Name_over_100_characters_after_trimming_is_rejected_but_100_is_accepted()
    {
        Assert.Equal(
            "Enter a name of up to 100 characters",
            Errors(Valid(name: " " + new string('a', 101) + " "))["name"]);
        Assert.DoesNotContain("name", Errors(Valid(name: " " + new string('a', 100) + " ")).Keys);
    }

    [Theory]
    [InlineData(null, "Enter a opening balance greater than 0")]
    [InlineData(0.0, "Enter a opening balance greater than 0")]
    [InlineData(-1.0, "Enter a opening balance greater than 0")]
    [InlineData(1000000000000.00, "Enter a opening balance up to 999,999,999,999.99")]
    public void Opening_balance_bounds(double? value, string message) =>
        Assert.Equal(message, Errors(Valid(balance: (decimal?)value))["openingBalance"]);

    [Fact]
    public void Opening_balance_accepts_the_maximum_and_rejects_three_decimal_places()
    {
        Assert.DoesNotContain("openingBalance", Errors(Valid(balance: 999_999_999_999.99m)).Keys);
        Assert.Equal(
            "Enter a opening balance with up to 2 decimal places",
            Errors(Valid(balance: 10.005m))["openingBalance"]);
    }

    [Fact]
    public void Decimal_extremes_hit_the_bound_messages()
    {
        var errors = Errors(Valid(
            balance: decimal.MaxValue,
            periods: decimal.MaxValue,
            rows: new RateChangeCandidate(decimal.MaxValue, "2000-01-01")));
        Assert.Equal("Enter a opening balance up to 999,999,999,999.99", errors["openingBalance"]);
        Assert.Equal(
            "The final repayment date would be later than 31 Dec 9999",
            errors["duration"]);
        Assert.Equal(
            "Enter an interest rate from 0 to 100",
            errors["interestRateChanges[0].newInterestRate"]);

        var low = Errors(Valid(
            balance: decimal.MinValue,
            periods: decimal.MinValue,
            rows: new RateChangeCandidate(decimal.MinValue, "2000-01-01")));
        Assert.Equal("Enter a opening balance greater than 0", low["openingBalance"]);
        Assert.Equal("Enter a whole number of 1 or more", low["duration"]);
        Assert.Equal("Enter an interest rate from 0 to 100", low["interestRateChanges[0].newInterestRate"]);
    }

    [Theory]
    [InlineData(1.5)]
    [InlineData(0)]
    [InlineData(-1)]
    public void Duration_must_be_a_whole_number_of_one_or_more(double value) =>
        Assert.Equal(
            "Enter a whole number of 1 or more",
            Errors(Valid(periods: (decimal)value))["duration"]);

    [Fact]
    public void Duration_past_31_Dec_9999_is_rejected()
    {
        const string message = "The final repayment date would be later than 31 Dec 9999";
        Assert.Equal(message, Errors(Valid(periods: 3_000_000_000m))["duration"]);
        Assert.Equal(message, Errors(Valid(periods: 200_000m))["duration"]);
    }

    [Theory]
    [InlineData("2000-13-45")]
    [InlineData("01/01/2000")]
    [InlineData("")]
    [InlineData(null)]
    public void Unreadable_drawdown_date_is_rejected(string? value) =>
        Assert.Equal("Enter a valid date", Errors(Valid(first: value))["drawdownDate"]);

    [Fact]
    public void Future_date_bound_is_the_latest_date_anywhere_in_the_world()
    {
        // 09:59 UTC on 15 Jun is 23:59 on 15 Jun at UTC+14: 16 Jun is still in the future everywhere.
        var early = new FixedTimeProvider(new DateTimeOffset(2026, 6, 15, 9, 59, 0, TimeSpan.Zero));
        var late = new FixedTimeProvider(new DateTimeOffset(2026, 6, 15, 10, 0, 0, TimeSpan.Zero));
        var candidate = Valid(first: "2026-06-16", periods: 12m, rows: new RateChangeCandidate(5m, "2026-06-16"));

        Assert.Equal(
            "Enter a date that is not in the future",
            MortgageValidator.Validate(candidate, early).Errors["drawdownDate"]);
        Assert.Empty(MortgageValidator.Validate(candidate, late).Errors);
    }

    [Theory]
    [InlineData("Daily")]
    [InlineData("weekly")]
    [InlineData(null)]
    public void Frequency_must_match_exactly(string? value) =>
        Assert.Equal(
            "Choose Weekly, Fortnightly or Monthly",
            Errors(Valid(frequency: value))["paymentFrequency"]);

    [Fact]
    public void Opening_rate_is_required_including_when_there_are_no_rows()
    {
        const string message = "Add the opening interest rate, effective on the drawdown date";
        Assert.Equal(
            message,
            Errors(Valid(rows: new RateChangeCandidate(5m, "2000-02-01")))["interestRateChanges"]);
        Assert.Equal(
            message,
            Errors(new MortgageCandidate("A", 1m, 12m, "2000-01-01", "Monthly", []))["interestRateChanges"]);
    }

    [Fact]
    public void A_row_with_both_fields_null_is_ignored_and_not_counted()
    {
        var rows = new List<RateChangeCandidate> { new(5m, "2000-01-01") };
        rows.AddRange(Enumerable.Range(0, 100).Select(_ => new RateChangeCandidate(null, null)));

        var result = MortgageValidator.Validate(
            new MortgageCandidate("A", 1m, 12m, "2000-01-01", "Monthly", rows),
            Clock);

        Assert.Empty(result.Errors);
        Assert.Single(result.Value!.RateChanges);
    }

    [Fact]
    public void More_than_60_rows_is_rejected()
    {
        var rows = Enumerable.Range(0, 61)
            .Select(index => new RateChangeCandidate(5m, new DateOnly(2000, 1, 1).AddDays(index)
                .ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)))
            .ToArray();

        Assert.Equal(
            "A mortgage can have up to 60 interest rate changes",
            Errors(Valid(periods: 360m, rows: rows))["interestRateChanges"]);
    }

    [Fact]
    public void Partly_filled_rows_are_flagged_under_the_missing_field()
    {
        var errors = Errors(Valid(rows:
        [
            new RateChangeCandidate(5m, "2000-01-01"),
            new RateChangeCandidate(null, "2000-02-01"),
            new RateChangeCandidate(4m, null),
        ]));

        Assert.Equal("Enter an interest rate", errors["interestRateChanges[1].newInterestRate"]);
        Assert.Equal("Enter a valid date", errors["interestRateChanges[2].effectiveDate"]);
    }

    [Theory]
    [InlineData(-0.01, "Enter an interest rate from 0 to 100")]
    [InlineData(100.01, "Enter an interest rate from 0 to 100")]
    [InlineData(5.001, "Enter an interest rate with up to 2 decimal places")]
    public void Rate_bounds(double rate, string message) =>
        Assert.Equal(
            message,
            Errors(Valid(rows: new RateChangeCandidate((decimal)rate, "2000-01-01")))
                ["interestRateChanges[0].newInterestRate"]);

    [Fact]
    public void Duplicate_effective_dates_flag_every_such_row()
    {
        var errors = Errors(Valid(rows:
        [
            new RateChangeCandidate(5m, "2000-01-01"),
            new RateChangeCandidate(6m, "2000-02-01"),
            new RateChangeCandidate(7m, "2000-02-01"),
        ]));

        Assert.Equal("This effective date is already used", errors["interestRateChanges[1].effectiveDate"]);
        Assert.Equal("This effective date is already used", errors["interestRateChanges[2].effectiveDate"]);
    }

    [Fact]
    public void Out_of_range_dates_use_the_invariant_formatted_range_message()
    {
        var previous = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = new CultureInfo("fr-FR");
        try
        {
            var errors = Errors(new MortgageCandidate(
                "A",
                1m,
                1m,
                "0001-01-01",
                "Monthly",
                [new RateChangeCandidate(5m, "0001-01-01"), new RateChangeCandidate(5m, "0001-02-01")]));

            Assert.Equal(
                "Choose a date from 1 Jan 0001 to 1 Jan 0001",
                errors["interestRateChanges[1].effectiveDate"]);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }

        Assert.Equal(
            "Choose a date from 1 Jan 2000 to 1 Dec 2029",
            Errors(Valid(rows:
            [
                new RateChangeCandidate(5m, "2000-01-01"),
                new RateChangeCandidate(5m, "2029-12-02"),
            ]))["interestRateChanges[1].effectiveDate"]);
    }

    [Fact]
    public void Unreadable_effective_dates_are_flagged()
    {
        var errors = Errors(Valid(rows:
        [
            new RateChangeCandidate(5m, "2000-01-01"),
            new RateChangeCandidate(5m, "2000-13-45"),
            new RateChangeCandidate(5m, "01/01/2000"),
        ]));

        Assert.Equal("Enter a valid date", errors["interestRateChanges[1].effectiveDate"]);
        Assert.Equal("Enter a valid date", errors["interestRateChanges[2].effectiveDate"]);
    }

    [Fact]
    public void Rows_are_not_range_checked_while_a_header_field_is_invalid()
    {
        var errors = Errors(new MortgageCandidate(
            "A",
            1m,
            1.5m,
            "2000-01-01",
            "Monthly",
            [new RateChangeCandidate(5m, "1999-01-01")]));

        Assert.Equal(["duration"], errors.Keys);
    }

    [Fact]
    public void First_applicable_row_wins_per_key()
    {
        var errors = Errors(Valid(name: " ", balance: -5m));

        Assert.Equal("Enter a name", errors["name"]);
        Assert.Equal("Enter a opening balance greater than 0", errors["openingBalance"]);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
