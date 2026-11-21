using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Clutch.API.Application.Mortgages;

public static class MortgageMetrics
{
    public const string MeterName = "Clutch.API.Mortgages";

    private static readonly Meter Meter = new(MeterName, "1.0.0");
    private static readonly Counter<long> SaveOutcomes =
        Meter.CreateCounter<long>("clutch.mortgage.save.outcomes", "{save}");
    private static readonly Histogram<double> SaveDuration =
        Meter.CreateHistogram<double>("clutch.mortgage.save.duration", "ms");
    private static readonly Counter<long> DeleteOutcomes =
        Meter.CreateCounter<long>("clutch.mortgage.delete.outcomes", "{delete}");
    private static readonly Histogram<double> DeleteDuration =
        Meter.CreateHistogram<double>("clutch.mortgage.delete.duration", "ms");

    public static long Start() => Stopwatch.GetTimestamp();

    // operation: create | update. outcome: success | invalid | conflict | not_found | failure.
    public static void RecordSave(string operation, string outcome, long startedAtTimestamp)
    {
        var tags = new KeyValuePair<string, object?>[]
        {
            new("operation", operation),
            new("outcome", outcome),
        };
        SaveOutcomes.Add(1, tags);
        SaveDuration.Record(Stopwatch.GetElapsedTime(startedAtTimestamp).TotalMilliseconds, tags);
    }

    public static void RecordDelete(string outcome, long startedAtTimestamp)
    {
        var tags = new KeyValuePair<string, object?>("outcome", outcome);
        DeleteOutcomes.Add(1, tags);
        DeleteDuration.Record(Stopwatch.GetElapsedTime(startedAtTimestamp).TotalMilliseconds, tags);
    }
}
