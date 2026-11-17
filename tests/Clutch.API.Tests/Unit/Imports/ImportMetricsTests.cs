using System.Diagnostics.Metrics;
using Clutch.API.Application.Imports;

namespace Clutch.API.Tests.Unit.Imports;

public sealed class ImportMetricsTests
{
    [Fact]
    public void Import_metrics_emit_outcomes_duration_transaction_count_and_rate()
    {
        var measurements = new Dictionary<string, List<double>>(StringComparer.Ordinal);
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == ImportMetrics.MeterName)
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((instrument, value, _, _) =>
        {
            AddMeasurement(measurements, instrument.Name, value);
        });
        listener.SetMeasurementEventCallback<double>((instrument, value, _, _) =>
        {
            AddMeasurement(measurements, instrument.Name, value);
        });
        listener.Start();

        using (var successfulImport = ImportMetrics.StartImport())
        {
            successfulImport.MarkSucceeded(2);
        }

        using (ImportMetrics.StartImport())
        {
        }

        ImportMetrics.RecordSettingsSave("failed", ImportMetrics.StartSettingsSave());

        Assert.Contains("clutch.import.outcomes", measurements.Keys);
        Assert.Contains("clutch.import.failures", measurements.Keys);
        Assert.Contains("clutch.import.transactions", measurements.Keys);
        Assert.Contains("clutch.import.duration", measurements.Keys);
        Assert.Contains("clutch.import.transactions_per_minute", measurements.Keys);
        Assert.Contains("clutch.import.settings_save.outcomes", measurements.Keys);
        Assert.Equal(2, measurements["clutch.import.outcomes"].Count);
        Assert.Contains(2, measurements["clutch.import.transactions"]);
        Assert.Contains("clutch.import.settings_save.duration", measurements.Keys);
    }

    [Fact]
    public void Coordination_metrics_use_bounded_operations_and_outcomes()
    {
        var measurements = new List<(string Name, string? Operation, string? Outcome, string[] TagKeys)>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == ImportMetrics.MeterName)
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((instrument, _, tags, _) =>
        {
            measurements.Add(Observation(instrument.Name, tags));
        });
        listener.SetMeasurementEventCallback<double>((instrument, _, tags, _) =>
        {
            measurements.Add(Observation(instrument.Name, tags));
        });
        listener.Start();

        using (var status = ImportMetrics.StartCoordination(ImportCoordinationOperation.Status))
        {
            status.MarkSucceeded(ImportCoordinationSuccessOutcome.Available);
        }

        using (var status = ImportMetrics.StartCoordination(ImportCoordinationOperation.Status))
        {
            status.MarkSucceeded(ImportCoordinationSuccessOutcome.Blocked);
        }

        using (var ending = ImportMetrics.StartCoordination(ImportCoordinationOperation.End))
        {
            ending.MarkFailed(ImportCoordinationError.ImportChanged);
        }

        using (ImportMetrics.StartCoordination(ImportCoordinationOperation.Claim))
        {
        }

        Assert.Contains(measurements, item =>
            item.Name == "clutch.import.coordination.outcomes"
            && item.Operation == "status"
            && item.Outcome == "available");
        Assert.Contains(measurements, item =>
            item.Name == "clutch.import.coordination.outcomes"
            && item.Operation == "status"
            && item.Outcome == "blocked");
        Assert.Contains(measurements, item =>
            item.Name == "clutch.import.coordination.outcomes"
            && item.Operation == "end"
            && item.Outcome == "import_changed");
        Assert.Contains(measurements, item =>
            item.Name == "clutch.import.coordination.outcomes"
            && item.Operation == "claim"
            && item.Outcome == "failure");
        Assert.Contains(measurements, item =>
            item.Name == "clutch.import.coordination.failures"
            && item.Operation == "end"
            && item.Outcome == "import_changed");
        Assert.Contains(measurements, item =>
            item.Name == "clutch.import.coordination.duration"
            && item.Operation == "status");
        Assert.All(measurements.Where(item => item.Operation is not null), item =>
            Assert.Contains(item.Operation, new[] { "status", "end", "claim" }));
        Assert.All(measurements.Where(item => item.Outcome is not null), item =>
            Assert.Contains(item.Outcome, new[]
            {
                "success",
                "available",
                "blocked",
                "failure",
                "account_not_found",
                "review_not_found",
                "import_changed",
                "import_expired",
                "import_not_endable",
                "import_ended_elsewhere",
                "ending_identity_unavailable",
                "import_outcome_unknown",
            }));
        Assert.All(measurements, item =>
            Assert.All(item.TagKeys, key => Assert.Contains(key, new[] { "operation", "outcome" })));
    }

    private static (string Name, string? Operation, string? Outcome, string[] TagKeys) Observation(
        string name,
        ReadOnlySpan<KeyValuePair<string, object?>> tags)
    {
        string? operation = null;
        string? outcome = null;
        var tagKeys = new List<string>(tags.Length);
        foreach (var tag in tags)
        {
            tagKeys.Add(tag.Key);
            if (tag.Key == "operation")
            {
                operation = tag.Value?.ToString();
            }
            else if (tag.Key == "outcome")
            {
                outcome = tag.Value?.ToString();
            }
        }

        return (name, operation, outcome, tagKeys.ToArray());
    }

    private static void AddMeasurement(
        IDictionary<string, List<double>> measurements,
        string name,
        double value)
    {
        if (!measurements.TryGetValue(name, out var values))
        {
            values = [];
            measurements.Add(name, values);
        }

        values.Add(value);
    }
}
