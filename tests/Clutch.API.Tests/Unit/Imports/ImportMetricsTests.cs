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
