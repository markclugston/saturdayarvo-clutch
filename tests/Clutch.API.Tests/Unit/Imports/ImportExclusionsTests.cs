using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Transactions;

namespace Clutch.API.Tests.Unit.Imports;

public sealed class ImportExclusionsTests
{
    private static readonly DateOnly Day1 = new(2025, 3, 1);
    private static readonly DateOnly Day2 = new(2025, 3, 2);
    private static readonly DateOnly Day3 = new(2025, 3, 3);

    // Chronological balances: (in 100) 1100 -> (authorisation, out 40) 1100 -> (out 50) 1050
    // -> (in 25) 1075.

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Excludes_a_row_that_leaves_the_balance_unchanged_in_a_single_date_file(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1100m),
            Chronological(Day1, 40m, TransactionDirection.Outgoing, 1100m),
            Chronological(Day1, 50m, TransactionDirection.Outgoing, 1050m),
            Chronological(Day1, 25m, TransactionDirection.Incoming, 1075m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Equal(newestFirst ? ImportDirection.NewestFirst : ImportDirection.OldestFirst, result.Direction);
        Assert.Equal([newestFirst ? 4 : 3], result.ExcludedRowNumbers.Order());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Excludes_a_row_that_leaves_the_balance_unchanged_in_a_multi_date_file(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1100m),
            Chronological(Day2, 40m, TransactionDirection.Outgoing, 1100m),
            Chronological(Day2, 50m, TransactionDirection.Outgoing, 1050m),
            Chronological(Day3, 25m, TransactionDirection.Incoming, 1075m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Equal(newestFirst ? ImportDirection.NewestFirst : ImportDirection.OldestFirst, result.Direction);
        Assert.Equal([newestFirst ? 4 : 3], result.ExcludedRowNumbers.Order());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Excludes_an_incoming_authorisation_too(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1100m),
            Chronological(Day1, 40m, TransactionDirection.Incoming, 1100m),
            Chronological(Day1, 50m, TransactionDirection.Outgoing, 1050m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Equal([3], result.ExcludedRowNumbers.Order());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Excludes_an_authorisation_that_is_the_chronologically_last_row(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1100m),
            Chronological(Day1, 50m, TransactionDirection.Outgoing, 1050m),
            Chronological(Day1, 40m, TransactionDirection.Outgoing, 1050m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Equal(newestFirst ? ImportDirection.NewestFirst : ImportDirection.OldestFirst, result.Direction);
        Assert.Equal([newestFirst ? 2 : 4], result.ExcludedRowNumbers.Order());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Never_excludes_the_chronologically_first_row(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 10m, TransactionDirection.Outgoing, 1000m),
            Chronological(Day2, 100m, TransactionDirection.Incoming, 1100m),
            Chronological(Day3, 50m, TransactionDirection.Outgoing, 1050m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Empty(result.ExcludedRowNumbers);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Keeps_a_zero_amount_row_with_an_unchanged_balance(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1100m),
            Chronological(Day2, 0m, TransactionDirection.Outgoing, 1100m),
            Chronological(Day3, 50m, TransactionDirection.Outgoing, 1050m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Empty(result.ExcludedRowNumbers);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Keeps_a_row_with_no_balance_and_the_row_after_it(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1100m),
            Chronological(Day2, 40m, TransactionDirection.Outgoing, null, "Shop AUTHORISATION ONLY"),
            Chronological(Day3, 50m, TransactionDirection.Outgoing, 1100m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Empty(result.ExcludedRowNumbers);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Excludes_every_consecutive_authorisation(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1100m),
            Chronological(Day1, 40m, TransactionDirection.Outgoing, 1100m),
            Chronological(Day1, 15m, TransactionDirection.Outgoing, 1100m),
            Chronological(Day1, 50m, TransactionDirection.Outgoing, 1050m),
            Chronological(Day1, 25m, TransactionDirection.Incoming, 1075m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Equal(newestFirst ? ImportDirection.NewestFirst : ImportDirection.OldestFirst, result.Direction);
        Assert.Equal(newestFirst ? [4, 5] : [3, 4], result.ExcludedRowNumbers.Order());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Falls_back_to_dates_when_too_few_rows_remain_to_reconcile(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1000m),
            Chronological(Day2, 20m, TransactionDirection.Outgoing, 1000m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Equal(newestFirst ? ImportDirection.NewestFirst : ImportDirection.OldestFirst, result.Direction);
        Assert.Equal([newestFirst ? 2 : 3], result.ExcludedRowNumbers.Order());
    }

    [Fact]
    public void Uses_the_existing_newest_first_fallback_for_an_ambiguous_single_date_file()
    {
        // Nothing but the file order separates these rows, so the existing rule reads newest first.
        var rows = new[]
        {
            Row(2, Day1, 100m, TransactionDirection.Incoming, 1000m),
            Row(3, Day1, 20m, TransactionDirection.Outgoing, 1000m),
        };

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Equal(ImportDirection.NewestFirst, result.Direction);
        Assert.Equal([2], result.ExcludedRowNumbers.Order());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Compares_with_the_previous_row_in_the_file_even_when_its_date_is_later(bool newestFirst)
    {
        // Banks list pending authorisations at the newest end, dated by when each was made, so an
        // older dated one can follow newer dated rows.
        var rows = File(
            newestFirst,
            Chronological(Day1, 10m, TransactionDirection.Outgoing, 45m),
            Chronological(Day2, 20m, TransactionDirection.Outgoing, 25m),
            Chronological(Day3, 600m, TransactionDirection.Incoming, 625m),
            Chronological(Day1, 13m, TransactionDirection.Outgoing, 625m),
            Chronological(Day3, 89m, TransactionDirection.Outgoing, 625m),
            Chronological(Day3, 71m, TransactionDirection.Outgoing, 625m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Equal(newestFirst ? ImportDirection.NewestFirst : ImportDirection.OldestFirst, result.Direction);
        Assert.Equal(newestFirst ? [2, 3, 4] : [5, 6, 7], result.ExcludedRowNumbers.Order());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Excludes_nothing_from_a_file_whose_balances_all_change(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1100m),
            Chronological(Day1, 50m, TransactionDirection.Outgoing, 1050m),
            Chronological(Day1, 25m, TransactionDirection.Incoming, 1075m));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Equal(newestFirst ? ImportDirection.NewestFirst : ImportDirection.OldestFirst, result.Direction);
        Assert.Empty(result.ExcludedRowNumbers);
    }

    [Theory]
    [InlineData("AUTH")]
    [InlineData("Card auth 4521")]
    [InlineData("AUTHORISATION ONLY")]
    [InlineData("Fuel Authorization")]
    [InlineData("PREAUTH")]
    [InlineData("PRE-AUTH")]
    [InlineData("pre auth")]
    [InlineData("PREAUTHORISATION")]
    [InlineData("PRE-AUTHORIZATION")]
    [InlineData("Pre Authorisation hotel")]
    [InlineData("AUTHONLY")]
    [InlineData("AUTH-ONLY")]
    [InlineData("Auth Only")]
    [InlineData("AUTHHOLD")]
    [InlineData("AUTH-HOLD")]
    [InlineData("auth hold")]
    [InlineData("PENDINGAUTH")]
    [InlineData("PENDING-AUTH")]
    [InlineData("Pending Auth")]
    [InlineData("OPENAUTH")]
    [InlineData("OPEN-AUTH")]
    [InlineData("Open Auth")]
    [InlineData("UNCAPTUREDAUTH")]
    [InlineData("UNCAPTURED-AUTH")]
    [InlineData("Uncaptured Auth")]
    [InlineData("CARDVERIFICATION")]
    [InlineData("CARD-VERIFICATION")]
    [InlineData("Card Verification 0.00")]
    [InlineData("ZERODOLLARAUTH")]
    [InlineData("ZERO-DOLLAR-AUTH")]
    [InlineData("Zero Amount Auth")]
    [InlineData("ZEROVALUE AUTH")]
    [InlineData("Shop (AUTH)")]
    public void Excludes_a_description_matching_an_authorisation_pattern_without_balances(string description)
    {
        var rows = new[]
        {
            Row(2, Day1, 10m, TransactionDirection.Outgoing, null, "Market"),
            Row(3, Day1, 10m, TransactionDirection.Outgoing, null, description),
        };

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: false);

        Assert.Equal([3], result.ExcludedRowNumbers.Order());
    }

    [Theory]
    [InlineData("Market")]
    [InlineData("Water Authority")]
    [InlineData("Authentic Pizza")]
    [InlineData("Author Talk")]
    [InlineData("Authorised Repairer")]
    [InlineData("Preauthorised Payment")]
    [InlineData("Authorisations Desk")]
    [InlineData("OAUTH Software")]
    [InlineData("AUTHONLYX")]
    [InlineData("Card Verifications Ltd")]
    [InlineData("Pre Authentic")]
    public void Keeps_a_description_where_a_pattern_is_only_part_of_a_word(string description)
    {
        var rows = new[] { Row(2, Day1, 10m, TransactionDirection.Outgoing, null, description) };

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: false);

        Assert.Empty(result.ExcludedRowNumbers);
    }

    [Fact]
    public void Excludes_every_matching_row_and_reads_the_direction_from_all_rows_without_balances()
    {
        // Only the excluded first row's date shows that the file runs oldest first.
        var rows = new[]
        {
            Row(2, Day1, 0m, TransactionDirection.Outgoing, null, "Zero Dollar Auth"),
            Row(3, Day2, 10m, TransactionDirection.Outgoing, null, "Market"),
            Row(4, Day2, 20m, TransactionDirection.Outgoing, null, "Fuel AUTH HOLD"),
        };

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: false);

        Assert.Equal(ImportDirection.OldestFirst, result.Direction);
        Assert.Equal([2, 4], result.ExcludedRowNumbers.Order());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Does_not_apply_the_description_rule_when_balances_are_imported(bool newestFirst)
    {
        var rows = File(
            newestFirst,
            Chronological(Day1, 100m, TransactionDirection.Incoming, 1100m, "AUTHORISATION ONLY"),
            Chronological(Day2, 50m, TransactionDirection.Outgoing, 1050m, "Fuel AUTH HOLD"));

        var result = ImportExclusions.Determine(rows, hasBalanceColumn: true);

        Assert.Empty(result.ExcludedRowNumbers);
    }

    private static (DateOnly Date, decimal Amount, TransactionDirection Direction, decimal? Balance, string Description)
        Chronological(
            DateOnly date,
            decimal amount,
            TransactionDirection direction,
            decimal? balance,
            string description = "Market") =>
        (date, amount, direction, balance, description);

    // Numbers rows from 2, as the parser does, in the order the file lists them.
    private static ImportExclusionRow[] File(
        bool newestFirst,
        params (DateOnly Date, decimal Amount, TransactionDirection Direction, decimal? Balance, string Description)[]
            chronological) =>
        (newestFirst ? chronological.Reverse() : chronological)
            .Select((row, index) => Row(
                index + 2,
                row.Date,
                row.Amount,
                row.Direction,
                row.Balance,
                row.Description))
            .ToArray();

    private static ImportExclusionRow Row(
        int sourceRowNumber,
        DateOnly date,
        decimal amount,
        TransactionDirection direction,
        decimal? balance,
        string description = "Market") =>
        new(new ImportOrderRow(sourceRowNumber, date, amount, direction, balance), description);
}
