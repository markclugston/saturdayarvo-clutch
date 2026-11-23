using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Transactions;

namespace Clutch.API.Tests.Unit.Imports;

public sealed class ImportOrderingTests
{
    private static readonly DateOnly Day1 = new(2025, 3, 1);
    private static readonly DateOnly Day2 = new(2025, 3, 2);
    private static readonly DateOnly Day3 = new(2025, 3, 3);

    // Chronological balances: 1000 -> (in 100) 1100 -> (out 50) 1050 -> (in 25) 1075.

    [Fact]
    public void InferDirection_uses_balances_for_a_newest_first_file()
    {
        var rows = new[]
        {
            Row(1, Day1, 25m, TransactionDirection.Incoming, 1075m),
            Row(2, Day1, 50m, TransactionDirection.Outgoing, 1050m),
            Row(3, Day1, 100m, TransactionDirection.Incoming, 1100m),
        };

        Assert.Equal(ImportDirection.NewestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void InferDirection_uses_balances_for_an_oldest_first_file_even_when_dates_disagree()
    {
        // Dates fall (would say newest first) but balances reconcile oldest first.
        var rows = new[]
        {
            Row(1, Day3, 100m, TransactionDirection.Incoming, 1100m),
            Row(2, Day2, 50m, TransactionDirection.Outgoing, 1050m),
            Row(3, Day1, 25m, TransactionDirection.Incoming, 1075m),
        };

        Assert.Equal(ImportDirection.OldestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void InferDirection_uses_balances_for_a_newest_first_file_even_when_dates_disagree()
    {
        // Dates rise (would say oldest first) but balances reconcile newest first.
        var rows = new[]
        {
            Row(1, Day1, 25m, TransactionDirection.Incoming, 1075m),
            Row(2, Day2, 50m, TransactionDirection.Outgoing, 1050m),
            Row(3, Day3, 100m, TransactionDirection.Incoming, 1100m),
        };

        Assert.Equal(ImportDirection.NewestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void InferDirection_falls_back_to_dates_when_both_directions_reconcile()
    {
        // Zero amounts and equal balances reconcile either way.
        var rows = new[]
        {
            Row(1, Day1, 0m, TransactionDirection.Incoming, 500m),
            Row(2, Day2, 0m, TransactionDirection.Incoming, 500m),
        };

        Assert.Equal(ImportDirection.OldestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void InferDirection_falls_back_to_dates_when_neither_direction_reconciles()
    {
        var rows = new[]
        {
            Row(1, Day3, 10m, TransactionDirection.Incoming, 999m),
            Row(2, Day2, 10m, TransactionDirection.Incoming, 111m),
            Row(3, Day1, 10m, TransactionDirection.Incoming, 555m),
        };

        Assert.Equal(ImportDirection.NewestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void InferDirection_with_a_single_row_uses_dates_and_so_newest_first()
    {
        var rows = new[] { Row(1, Day1, 10m, TransactionDirection.Incoming, 100m) };

        Assert.Equal(ImportDirection.NewestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void InferDirection_without_balances_uses_dates()
    {
        var rising = new[]
        {
            Row(1, Day1, 10m, TransactionDirection.Incoming, null),
            Row(2, Day3, 10m, TransactionDirection.Incoming, null),
        };
        var falling = new[]
        {
            Row(1, Day3, 10m, TransactionDirection.Incoming, null),
            Row(2, Day1, 10m, TransactionDirection.Incoming, null),
        };

        Assert.Equal(ImportDirection.OldestFirst, ImportOrdering.InferDirection(rising));
        Assert.Equal(ImportDirection.NewestFirst, ImportOrdering.InferDirection(falling));
    }

    [Fact]
    public void InferDirection_with_equal_dates_and_no_balances_is_newest_first()
    {
        var rows = new[]
        {
            Row(1, Day1, 10m, TransactionDirection.Incoming, null),
            Row(2, Day1, 10m, TransactionDirection.Incoming, null),
            Row(3, Day1, 10m, TransactionDirection.Incoming, null),
        };

        Assert.Equal(ImportDirection.NewestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void InferDirection_with_non_monotonic_dates_compares_first_and_last()
    {
        var firstEarlier = new[]
        {
            Row(1, Day1, 10m, TransactionDirection.Incoming, null),
            Row(2, Day3, 10m, TransactionDirection.Incoming, null),
            Row(3, Day2, 10m, TransactionDirection.Incoming, null),
        };
        var firstLater = new[]
        {
            Row(1, Day2, 10m, TransactionDirection.Incoming, null),
            Row(2, Day3, 10m, TransactionDirection.Incoming, null),
            Row(3, Day1, 10m, TransactionDirection.Incoming, null),
        };

        Assert.Equal(ImportDirection.OldestFirst, ImportOrdering.InferDirection(firstEarlier));
        Assert.Equal(ImportDirection.NewestFirst, ImportOrdering.InferDirection(firstLater));
    }

    [Fact]
    public void InferDirection_with_any_missing_balance_uses_dates()
    {
        // The two reconciling pairs would say oldest first, but one balance is missing.
        var rows = new[]
        {
            Row(1, Day3, 100m, TransactionDirection.Incoming, 1100m),
            Row(2, Day2, 50m, TransactionDirection.Outgoing, null),
            Row(3, Day1, 25m, TransactionDirection.Incoming, 1075m),
        };

        Assert.Equal(ImportDirection.NewestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void InferDirection_treats_an_opposite_balance_sign_convention_as_neither_direction()
    {
        // A debt shown as a positive balance: a payment (incoming) lowers it, a charge (outgoing)
        // raises it. FR-011 reads incoming as adding, so neither direction reconciles.
        var rows = new[]
        {
            Row(1, Day1, 100m, TransactionDirection.Incoming, 900m),
            Row(2, Day2, 50m, TransactionDirection.Outgoing, 950m),
        };

        Assert.Equal(ImportDirection.OldestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void InferDirection_does_not_choose_a_direction_from_a_partly_broken_file()
    {
        // First pair reconciles oldest first, second pair does not reconcile either way.
        var rows = new[]
        {
            Row(1, Day3, 100m, TransactionDirection.Incoming, 1100m),
            Row(2, Day2, 50m, TransactionDirection.Outgoing, 1050m),
            Row(3, Day1, 25m, TransactionDirection.Incoming, 7m),
        };

        Assert.Equal(ImportDirection.NewestFirst, ImportOrdering.InferDirection(rows));
    }

    [Fact]
    public void ChronologicalGroups_reverses_each_date_for_a_newest_first_file()
    {
        var rows = new[]
        {
            Row(1, Day2, 1m, TransactionDirection.Incoming, null),
            Row(2, Day2, 1m, TransactionDirection.Incoming, null),
            Row(3, Day2, 1m, TransactionDirection.Incoming, null),
            Row(4, Day1, 1m, TransactionDirection.Incoming, null),
            Row(5, Day1, 1m, TransactionDirection.Incoming, null),
        };

        var groups = ImportOrdering.ChronologicalGroups(rows, ImportDirection.NewestFirst);

        Assert.Equal([3, 2, 1], groups[Day2].Select(row => row.SourceRowNumber));
        Assert.Equal([5, 4], groups[Day1].Select(row => row.SourceRowNumber));
    }

    [Fact]
    public void ChronologicalGroups_keeps_file_order_for_an_oldest_first_file()
    {
        var rows = new[]
        {
            Row(1, Day1, 1m, TransactionDirection.Incoming, null),
            Row(2, Day1, 1m, TransactionDirection.Incoming, null),
            Row(3, Day2, 1m, TransactionDirection.Incoming, null),
            Row(4, Day2, 1m, TransactionDirection.Incoming, null),
        };

        var groups = ImportOrdering.ChronologicalGroups(rows, ImportDirection.OldestFirst);

        Assert.Equal([1, 2], groups[Day1].Select(row => row.SourceRowNumber));
        Assert.Equal([3, 4], groups[Day2].Select(row => row.SourceRowNumber));
    }

    [Fact]
    public void ChronologicalGroups_gives_identical_rows_their_own_positions()
    {
        var rows = new[]
        {
            Row(1, Day1, 5m, TransactionDirection.Outgoing, null),
            Row(2, Day1, 5m, TransactionDirection.Outgoing, null),
            Row(3, Day1, 5m, TransactionDirection.Outgoing, null),
        };

        var groups = ImportOrdering.ChronologicalGroups(rows, ImportDirection.NewestFirst);

        Assert.Equal([3, 2, 1], groups[Day1].Select(row => row.SourceRowNumber));
    }

    [Fact]
    public void ChronologicalGroups_groups_non_monotonic_dates_per_date()
    {
        var rows = new[]
        {
            Row(1, Day2, 1m, TransactionDirection.Incoming, null),
            Row(2, Day1, 1m, TransactionDirection.Incoming, null),
            Row(3, Day2, 1m, TransactionDirection.Incoming, null),
            Row(4, Day1, 1m, TransactionDirection.Incoming, null),
        };

        var groups = ImportOrdering.ChronologicalGroups(rows, ImportDirection.NewestFirst);

        Assert.Equal(2, groups.Count);
        Assert.Equal([3, 1], groups[Day2].Select(row => row.SourceRowNumber));
        Assert.Equal([4, 2], groups[Day1].Select(row => row.SourceRowNumber));
    }

    private static ImportOrderRow Row(
        int sourceRowNumber,
        DateOnly date,
        decimal amount,
        TransactionDirection direction,
        decimal? balance) =>
        new(sourceRowNumber, date, amount, direction, balance);
}
