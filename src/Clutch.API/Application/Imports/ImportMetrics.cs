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
    private static readonly Counter<long> CoordinationOutcomes =
        Meter.CreateCounter<long>("clutch.import.coordination.outcomes", "{operation}");
    private static readonly Counter<long> CoordinationFailures =
        Meter.CreateCounter<long>("clutch.import.coordination.failures", "{operation}");
    private static readonly Histogram<double> CoordinationDuration =
        Meter.CreateHistogram<double>("clutch.import.coordination.duration", "ms");

    public static ImportMeasurement StartImport() => new();

    public static long StartSettingsSave() => Stopwatch.GetTimestamp();

    public static CoordinationMeasurement StartCoordination(ImportCoordinationOperation operation) =>
        new(operation);

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

    public sealed class CoordinationMeasurement(ImportCoordinationOperation operation) : IDisposable
    {
        private readonly long startedAtTimestamp = Stopwatch.GetTimestamp();
        private string outcome = "failure";
        private bool completed;
        private bool disposed;

        public void MarkSucceeded(
            ImportCoordinationSuccessOutcome result = ImportCoordinationSuccessOutcome.Success)
        {
            outcome = SuccessOutcomeName(result);
            completed = true;
        }

        public void MarkFailed(ImportCoordinationError error)
        {
            outcome = OutcomeName(error);
            completed = true;
        }

        public void Dispose()
        {
            if (disposed)
            {
                return;
            }

            disposed = true;
            var finalOutcome = completed ? outcome : "failure";
            var tags = new KeyValuePair<string, object?>[]
            {
                new("operation", OperationName(operation)),
                new("outcome", finalOutcome),
            };
            CoordinationOutcomes.Add(1, tags);
            CoordinationDuration.Record(Stopwatch.GetElapsedTime(startedAtTimestamp).TotalMilliseconds, tags);
            if (finalOutcome != "success")
            {
                CoordinationFailures.Add(1, tags);
            }
        }
    }

    private static string OperationName(ImportCoordinationOperation operation) =>
        operation switch
        {
            ImportCoordinationOperation.Status => "status",
            ImportCoordinationOperation.End => "end",
            ImportCoordinationOperation.Claim => "claim",
            _ => "unknown",
        };

    private static string OutcomeName(ImportCoordinationError error) =>
        error switch
        {
            ImportCoordinationError.AccountNotFound => "account_not_found",
            ImportCoordinationError.ReviewNotFound => "review_not_found",
            ImportCoordinationError.ImportChanged => "import_changed",
            ImportCoordinationError.ImportExpired => "import_expired",
            ImportCoordinationError.ImportNotEndable => "import_not_endable",
            ImportCoordinationError.ImportEndedElsewhere => "import_ended_elsewhere",
            ImportCoordinationError.EndingIdentityUnavailable => "ending_identity_unavailable",
            ImportCoordinationError.ImportOutcomeUnknown => "import_outcome_unknown",
            _ => "failure",
        };

    private static string SuccessOutcomeName(ImportCoordinationSuccessOutcome outcome) =>
        outcome switch
        {
            ImportCoordinationSuccessOutcome.Success => "success",
            ImportCoordinationSuccessOutcome.Available => "available",
            ImportCoordinationSuccessOutcome.Blocked => "blocked",
            _ => "success",
        };
}

public enum ImportCoordinationOperation
{
    Status,
    End,
    Claim,
}

public enum ImportCoordinationSuccessOutcome
{
    Success,
    Available,
    Blocked,
}
