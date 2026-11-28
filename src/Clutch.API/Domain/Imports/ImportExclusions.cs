using System.Text.RegularExpressions;

namespace Clutch.API.Domain.Imports;

public sealed record ImportExclusionRow(ImportOrderRow Order, string Description);

public sealed record ImportExclusionResult(
    ImportDirection Direction,
    IReadOnlySet<int> ExcludedRowNumbers);

/// <summary>
/// Pure rules for the rows an import leaves out because they look like pending authorisations,
/// and the file direction that goes with them.
/// </summary>
public static partial class ImportExclusions
{
    /// <summary>
    /// With a balance column, a row with a non-zero amount that leaves the previous row's balance
    /// unchanged is excluded. Which row is previous depends on the direction, so both are tried: the
    /// one whose remaining balances reconcile wins, otherwise the existing ordering rules decide.
    /// Without a balance column, a row whose description names an authorisation is excluded.
    /// </summary>
    public static ImportExclusionResult Determine(
        IReadOnlyList<ImportExclusionRow> rows,
        bool hasBalanceColumn)
    {
        ArgumentNullException.ThrowIfNull(rows);
        var orderRows = rows.Select(row => row.Order).ToArray();
        if (!hasBalanceColumn)
        {
            return new(
                ImportOrdering.InferDirection(orderRows),
                rows.Where(row => AuthorisationDescription().IsMatch(row.Description))
                    .Select(row => row.Order.SourceRowNumber)
                    .ToHashSet());
        }

        var newestFirst = ByUnchangedBalance(orderRows, ImportDirection.NewestFirst);
        var oldestFirst = ByUnchangedBalance(orderRows, ImportDirection.OldestFirst);
        var newestFirstReconciles = RemainderReconciles(orderRows, newestFirst);
        if (newestFirstReconciles != RemainderReconciles(orderRows, oldestFirst))
        {
            return newestFirstReconciles ? newestFirst : oldestFirst;
        }

        return ImportOrdering.InferDirection(orderRows) == ImportDirection.NewestFirst
            ? newestFirst
            : oldestFirst;
    }

    // One alternative per authorisation scenario: \b is a word boundary and [- ]? an optional hyphen
    // or space. Nothing repeats without bound, so matching cannot backtrack excessively.
    [GeneratedRegex(
        @"\bAUTH\b"
        + @"|\bAUTHORI[ZS]ATION\b"
        + @"|\bPRE[- ]?AUTH\b"
        + @"|\bPRE[- ]?AUTHORI[ZS]ATION\b"
        + @"|\bAUTH[- ]?ONLY\b"
        + @"|\bAUTH[- ]?HOLD\b"
        + @"|\bPENDING[- ]?AUTH\b"
        + @"|\bOPEN[- ]?AUTH\b"
        + @"|\bUNCAPTURED[- ]?AUTH\b"
        + @"|\bCARD[- ]?VERIFICATION\b"
        + @"|\bZERO[- ]?(DOLLAR|AMOUNT|VALUE)[- ]?AUTH\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.ExplicitCapture)]
    private static partial Regex AuthorisationDescription();

    private static ImportExclusionResult ByUnchangedBalance(
        IReadOnlyList<ImportOrderRow> rows,
        ImportDirection direction)
    {
        var excluded = new HashSet<int>();
        ImportOrderRow? previous = null;
        // Balances run in file order. Dates do not: a bank can list a pending authorisation among
        // later dated rows.
        var inFileOrder = rows.OrderBy(row => row.SourceRowNumber);
        var earliestFirst = direction == ImportDirection.NewestFirst
            ? inFileOrder.Reverse()
            : inFileOrder;
        foreach (var row in earliestFirst)
        {
            // Compared with the row immediately before it, excluded or not, so a run of
            // authorisations is excluded as a whole.
            if (row.Amount != 0 && row.Balance is { } balance && previous?.Balance == balance)
            {
                excluded.Add(row.SourceRowNumber);
            }

            previous = row;
        }

        return new(direction, excluded);
    }

    private static bool RemainderReconciles(
        IReadOnlyList<ImportOrderRow> rows,
        ImportExclusionResult candidate) =>
        ImportOrdering.InferDirectionFromBalances(
            rows.Where(row => !candidate.ExcludedRowNumbers.Contains(row.SourceRowNumber)).ToArray())
        == candidate.Direction;
}
