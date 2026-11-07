using Clutch.API.Domain.Transactions;

namespace Clutch.API.Application.Imports;

public static class DuplicateDetector
{
    public static IReadOnlySet<int> FindDuplicateRows(
        IEnumerable<TransactionFingerprint> existingTransactions,
        IEnumerable<ImportFingerprintRow> importRows)
    {
        var existingKeys = existingTransactions.ToHashSet();
        var rows = importRows.ToArray();
        var countsByKey = rows
            .GroupBy(row => row.Fingerprint)
            .ToDictionary(group => group.Key, group => group.Count());

        return rows
            .Where(row => existingKeys.Contains(row.Fingerprint) || countsByKey[row.Fingerprint] > 1)
            .Select(row => row.SourceRowNumber)
            .ToHashSet();
    }
}

public sealed record TransactionFingerprint(
    DateOnly TransactionDate,
    string Description,
    decimal Amount,
    TransactionDirection Direction);

public sealed record ImportFingerprintRow(int SourceRowNumber, TransactionFingerprint Fingerprint);
