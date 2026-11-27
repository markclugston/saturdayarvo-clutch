using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Clutch.API.Application.Assets;

// Tags carry the operation and outcome only: never ids, names or values.
public static class AssetMetrics
{
    public const string MeterName = "Clutch.API.Assets";

    private static readonly Meter Meter = new(MeterName, "1.0.0");
    private static readonly Instruments Save = Create("clutch.asset.save", "{save}");
    private static readonly Instruments Delete = Create("clutch.asset.delete", "{delete}");
    private static readonly Instruments Acquire = Create("clutch.asset.edit.acquire", "{operation}");
    private static readonly Instruments End = Create("clutch.asset.edit.end", "{operation}");
    private static readonly Instruments Status = Create("clutch.asset.edit.status", "{operation}");
    private static readonly Counter<long> Expired =
        Meter.CreateCounter<long>("clutch.asset.edit.expired", "{edit}");

    public static long Start() => Stopwatch.GetTimestamp();

    // operation: create | update.
    public static void RecordSave(string operation, string outcome, long startedAtTimestamp) =>
        Record(Save, operation, outcome, startedAtTimestamp);

    public static void RecordDelete(string outcome, long startedAtTimestamp) =>
        Record(Delete, "delete", outcome, startedAtTimestamp);

    public static void RecordAcquire(string outcome, long startedAtTimestamp) =>
        Record(Acquire, "acquire", outcome, startedAtTimestamp);

    public static void RecordEnd(string outcome, long startedAtTimestamp) =>
        Record(End, "end", outcome, startedAtTimestamp);

    public static void RecordStatus(string outcome, long startedAtTimestamp) =>
        Record(Status, "status", outcome, startedAtTimestamp);

    // operation: acquire | release, whichever persisted the expiry.
    public static void RecordExpired(string operation) =>
        Expired.Add(
            1,
            new KeyValuePair<string, object?>("operation", operation),
            new KeyValuePair<string, object?>("outcome", "expired"));

    private static Instruments Create(string name, string unit) =>
        new(
            Meter.CreateCounter<long>($"{name}.outcomes", unit),
            Meter.CreateHistogram<double>($"{name}.duration", "ms"));

    private static void Record(Instruments instruments, string operation, string outcome, long startedAtTimestamp)
    {
        var tags = new KeyValuePair<string, object?>[]
        {
            new("operation", operation),
            new("outcome", outcome),
        };
        instruments.Outcomes.Add(1, tags);
        instruments.Duration.Record(Stopwatch.GetElapsedTime(startedAtTimestamp).TotalMilliseconds, tags);
    }

    private sealed record Instruments(Counter<long> Outcomes, Histogram<double> Duration);
}
