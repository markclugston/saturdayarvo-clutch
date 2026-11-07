using Clutch.API.Application.Imports;
using Clutch.API.Domain.Transactions;

namespace Clutch.API.Tests.Unit.Imports;

public sealed class DuplicateDetectorTests
{
    [Fact]
    public void FlagsExactExistingAndSameImportMatchesOnly()
    {
        var existing = Fingerprint("Market", 10m, TransactionDirection.Incoming);
        var exact = Fingerprint("Market", 10m, TransactionDirection.Incoming);
        var sameFile = Fingerprint("Cafe", 5m, TransactionDirection.Outgoing);
        var rows = new[]
        {
            new ImportFingerprintRow(2, exact),
            new ImportFingerprintRow(3, Fingerprint("Market", 11m, TransactionDirection.Incoming)),
            new ImportFingerprintRow(4, Fingerprint("Market", 10m, TransactionDirection.Outgoing)),
            new ImportFingerprintRow(5, Fingerprint("Cafe", 5m, TransactionDirection.Outgoing)),
            new ImportFingerprintRow(6, sameFile),
        };

        var duplicates = DuplicateDetector.FindDuplicateRows([existing], rows);

        Assert.Equal(new HashSet<int> { 2, 5, 6 }, duplicates);
    }

    private static TransactionFingerprint Fingerprint(
        string description,
        decimal amount,
        TransactionDirection direction) =>
        new(new DateOnly(2025, 1, 15), description, amount, direction);
}
