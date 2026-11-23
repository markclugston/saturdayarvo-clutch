using Clutch.API.Domain.Transactions;

namespace Clutch.API.Domain.Imports;

public enum ImportDirection
{
    NewestFirst,
    OldestFirst,
}

public sealed record ImportOrderRow(
    int SourceRowNumber,
    DateOnly TransactionDate,
    decimal Amount,
    TransactionDirection Direction,
    decimal? Balance);

/// <summary>
/// Pure ordering rules for a confirmed import: which way the file runs, and each date's rows
/// from earliest to latest.
/// </summary>
public static class ImportOrdering
{
    /// <summary>
    /// Picks the file direction. Balances decide only when exactly one direction reconciles for
    /// every adjacent pair; otherwise the first and last row dates decide (first later or equal
    /// means newest first).
    /// </summary>
    public static ImportDirection InferDirection(IReadOnlyList<ImportOrderRow> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);
        var ordered = InFileOrder(rows);

        if (ordered.Length >= 2)
        {
            var oldestFirst = true;
            var newestFirst = true;
            for (var index = 0; index < ordered.Length - 1; index++)
            {
                var current = ordered[index];
                var next = ordered[index + 1];
                oldestFirst &= Reconciles(earlier: current, later: next);
                newestFirst &= Reconciles(earlier: next, later: current);
            }

            if (oldestFirst != newestFirst)
            {
                return oldestFirst ? ImportDirection.OldestFirst : ImportDirection.NewestFirst;
            }
        }

        if (ordered.Length == 0)
        {
            return ImportDirection.NewestFirst;
        }

        return ordered[0].TransactionDate < ordered[^1].TransactionDate
            ? ImportDirection.OldestFirst
            : ImportDirection.NewestFirst;
    }

    /// <summary>
    /// Groups rows by date, each group earliest to latest: file order for an oldest-first file,
    /// reversed for a newest-first file.
    /// </summary>
    public static IReadOnlyDictionary<DateOnly, IReadOnlyList<ImportOrderRow>> ChronologicalGroups(
        IReadOnlyList<ImportOrderRow> rows,
        ImportDirection direction)
    {
        ArgumentNullException.ThrowIfNull(rows);
        return InFileOrder(rows)
            .GroupBy(row => row.TransactionDate)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<ImportOrderRow>)(direction == ImportDirection.NewestFirst
                    ? group.Reverse().ToArray()
                    : group.ToArray()));
    }

    // FR-011: incoming adds to the balance, outgoing subtracts; a missing balance never reconciles.
    private static bool Reconciles(ImportOrderRow earlier, ImportOrderRow later)
    {
        if (earlier.Balance is not { } before || later.Balance is not { } after)
        {
            return false;
        }

        var signed = later.Direction == TransactionDirection.Incoming ? later.Amount : -later.Amount;
        return after == before + signed;
    }

    private static ImportOrderRow[] InFileOrder(IReadOnlyList<ImportOrderRow> rows) =>
        rows.OrderBy(row => row.SourceRowNumber).ToArray();
}
