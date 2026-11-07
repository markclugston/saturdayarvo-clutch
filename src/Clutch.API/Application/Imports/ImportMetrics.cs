using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Clutch.API.Application.Imports;

public static class ImportMetrics
{
    public const string MeterName = "Clutch.API.Imports";

    private static readonly Meter Meter = new(MeterName, "1.0.0");
    private static readonly Counter<long> ImportOutcomes =
        Meter.CreateCounter<long>("clutch.import.outcomes", "{import}");
    private static readonly Counter<long> ImportFailures =
        Meter.CreateCounter<long>("clutch.import.failures", "{import}");
    private static readonly Counter<long> ImportedTransactions =
        Meter.CreateCounter<long>("clutch.import.transactions", "{transaction}");
    private static readonly Histogram<double> ImportDuration =
        Meter.CreateHistogram<double>("clutch.import.duration", "ms");
    private static readonly Histogram<double> ImportRate =
        Meter.CreateHistogram<double>("clutch.import.transactions_per_minute", "transaction/min");
    private static readonly Counter<long> SettingsSaveOutcomes =
        Meter.CreateCounter<long>("clutch.import.settings_save.outcomes", "{save}");
    private static readonly Histogram<double> SettingsSaveDuration =
        Meter.CreateHistogram<double>("clutch.import.settings_save.duration", "ms");

    public static ImportMeasurement StartImport() => new();

    public static long StartSettingsSave() => Stopwatch.GetTimestamp();

    public static void RecordSettingsSave(string outcome, long startedAtTimestamp)
    {
        var elapsed = Stopwatch.GetElapsedTime(startedAtTimestamp);
        var tags = new KeyValuePair<string, object?>("outcome", outcome);
        SettingsSaveOutcomes.Add(1, tags);
        SettingsSaveDuration.Record(elapsed.TotalMilliseconds, tags);
        if (outcome == "failed")
        {
            ImportFailures.Add(1, new KeyValuePair<string, object?>("operation", "settings_save"));
        }
    }

    public sealed class ImportMeasurement : IDisposable
    {
        private readonly long startedAtTimestamp = Stopwatch.GetTimestamp();
        private int importedCount;
        private bool succeeded;

        public void MarkSucceeded(int count)
        {
            importedCount = count;
            succeeded = true;
        }

        public void Dispose()
        {
            var elapsed = Stopwatch.GetElapsedTime(startedAtTimestamp);
            var outcome = succeeded ? "success" : "failure";
            var tags = new KeyValuePair<string, object?>("outcome", outcome);
            ImportOutcomes.Add(1, tags);
            ImportDuration.Record(elapsed.TotalMilliseconds, tags);

            if (!succeeded)
            {
                ImportFailures.Add(1, new KeyValuePair<string, object?>("operation", "confirm"));
                return;
            }

            ImportedTransactions.Add(importedCount);
            ImportRate.Record(
                importedCount / Math.Max(elapsed.TotalMinutes, 1d / 60_000),
                tags);
        }
    }
}
