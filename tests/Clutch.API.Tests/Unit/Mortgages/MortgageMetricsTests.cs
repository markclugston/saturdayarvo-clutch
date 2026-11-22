using System.Diagnostics.Metrics;
using Clutch.API.Application.Mortgages;

namespace Clutch.API.Tests.Unit.Mortgages;

public sealed class MortgageMetricsTests
{
    [Fact]
    public void Save_and_delete_outcomes_and_durations_are_recorded_on_the_mortgages_meter()
    {
        var names = new List<string>();
        var tagKeys = new List<string>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == "Clutch.API.Mortgages")
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((instrument, _, tags, _) =>
        {
            names.Add(instrument.Name);
            foreach (var tag in tags)
            {
                tagKeys.Add(tag.Key);
            }
        });
        listener.SetMeasurementEventCallback<double>((instrument, _, tags, _) =>
        {
            names.Add(instrument.Name);
            foreach (var tag in tags)
            {
                tagKeys.Add(tag.Key);
            }
        });
        listener.Start();

        MortgageMetrics.RecordSave("create", "success", MortgageMetrics.Start());
        MortgageMetrics.RecordDelete("conflict", MortgageMetrics.Start());

        Assert.Equal("Clutch.API.Mortgages", MortgageMetrics.MeterName);
        Assert.Contains("clutch.mortgage.save.outcomes", names);
        Assert.Contains("clutch.mortgage.save.duration", names);
        Assert.Contains("clutch.mortgage.delete.outcomes", names);
        Assert.Contains("clutch.mortgage.delete.duration", names);
        Assert.All(tagKeys, key => Assert.Contains(key, new[] { "operation", "outcome" }));
    }

    [Fact]
    public void Balance_reads_record_a_counter_and_duration_with_only_outcome_and_mode_tags()
    {
        var names = new List<string>();
        var tagKeys = new List<string>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == "Clutch.API.Mortgages")
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((instrument, _, tags, _) =>
        {
            names.Add(instrument.Name);
            tagKeys.AddRange(tags.ToArray().Select(tag => tag.Key));
        });
        listener.SetMeasurementEventCallback<double>((instrument, _, tags, _) =>
        {
            names.Add(instrument.Name);
            tagKeys.AddRange(tags.ToArray().Select(tag => tag.Key));
        });
        listener.Start();

        MortgageMetrics.RecordBalanceRead("mortgage", "success", MortgageMetrics.Start());

        Assert.Contains("clutch.mortgage.balances.outcomes", names);
        Assert.Contains("clutch.mortgage.balances.duration", names);
        Assert.All(tagKeys, key => Assert.Contains(key, new[] { "mode", "outcome" }));
    }
}
