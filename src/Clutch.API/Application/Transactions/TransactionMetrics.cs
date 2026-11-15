using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Clutch.API.Application.Transactions;

public static class TransactionMetrics
{
    public const string MeterName = "Clutch.API.Transactions";

    private static readonly Meter Meter = new(MeterName, "1.0.0");
    private static readonly Counter<long> DeleteOutcomes =
        Meter.CreateCounter<long>("clutch.transaction.delete.outcomes", "{delete}");
    private static readonly Histogram<double> DeleteDuration =
        Meter.CreateHistogram<double>("clutch.transaction.delete.duration", "ms");

    public static long StartDelete() => Stopwatch.GetTimestamp();

    public static void RecordDelete(string outcome, long startedAtTimestamp)
    {
        var elapsed = Stopwatch.GetElapsedTime(startedAtTimestamp);
        var tags = new KeyValuePair<string, object?>("outcome", outcome);
        DeleteOutcomes.Add(1, tags);
        DeleteDuration.Record(elapsed.TotalMilliseconds, tags);
    }
}
