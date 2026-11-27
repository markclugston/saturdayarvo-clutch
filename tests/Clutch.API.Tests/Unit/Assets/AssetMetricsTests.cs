using System.Diagnostics.Metrics;
using Clutch.API.Application.Assets;

namespace Clutch.API.Tests.Unit.Assets;

public sealed class AssetMetricsTests
{
    [Fact]
    public void Every_operation_records_a_counter_and_duration_with_only_operation_and_outcome_tags()
    {
        var measurements = new List<(string Name, Dictionary<string, object?> Tags)>();
        var thread = Environment.CurrentManagedThreadId;
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == "Clutch.API.Assets")
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        // Other tests record on the same static meter from other threads.
        void Capture(Instrument instrument, ReadOnlySpan<KeyValuePair<string, object?>> tags)
        {
            if (Environment.CurrentManagedThreadId == thread)
            {
                measurements.Add((instrument.Name, tags.ToArray().ToDictionary(tag => tag.Key, tag => tag.Value)));
            }
        }

        listener.SetMeasurementEventCallback<long>((instrument, _, tags, _) => Capture(instrument, tags));
        listener.SetMeasurementEventCallback<double>((instrument, _, tags, _) => Capture(instrument, tags));
        listener.Start();

        AssetMetrics.RecordSave("create", "success", AssetMetrics.Start());
        AssetMetrics.RecordDelete("EditActive", AssetMetrics.Start());
        AssetMetrics.RecordAcquire("blocked", AssetMetrics.Start());
        AssetMetrics.RecordEnd("changed", AssetMetrics.Start());
        AssetMetrics.RecordStatus("available", AssetMetrics.Start());
        AssetMetrics.RecordExpired("release");

        Assert.Equal("Clutch.API.Assets", AssetMetrics.MeterName);
        Assert.Equal(
            [
                "clutch.asset.save.outcomes", "clutch.asset.save.duration",
                "clutch.asset.delete.outcomes", "clutch.asset.delete.duration",
                "clutch.asset.edit.acquire.outcomes", "clutch.asset.edit.acquire.duration",
                "clutch.asset.edit.end.outcomes", "clutch.asset.edit.end.duration",
                "clutch.asset.edit.status.outcomes", "clutch.asset.edit.status.duration",
                "clutch.asset.edit.expired",
            ],
            measurements.Select(measurement => measurement.Name));
        Assert.All(measurements, measurement =>
            Assert.Equal(["operation", "outcome"], measurement.Tags.Keys.Order(StringComparer.Ordinal)));
        Assert.Equal(
            ["create", "delete", "acquire", "end", "status", "release"],
            measurements.Select(measurement => measurement.Tags["operation"]).Distinct());
        Assert.Equal(
            "EditActive",
            measurements.First(measurement => measurement.Name == "clutch.asset.delete.outcomes").Tags["outcome"]);
    }
}
