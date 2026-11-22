using System.Diagnostics.Metrics;
using Clutch.API.Application.Preferences;

namespace Clutch.API.Tests.Unit.Preferences;

public sealed class PreferenceMetricsTests
{
    [Fact]
    public void Navigation_save_outcomes_and_duration_are_recorded_on_the_preferences_meter()
    {
        var names = new List<string>();
        var outcomes = new List<string>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == "Clutch.API.Preferences")
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((instrument, _, tags, _) =>
        {
            names.Add(instrument.Name);
            foreach (var tag in tags)
            {
                Assert.Equal("outcome", tag.Key);
                outcomes.Add((string)tag.Value!);
            }
        });
        listener.SetMeasurementEventCallback<double>((instrument, _, _, _) =>
            names.Add(instrument.Name));
        listener.Start();

        PreferenceMetrics.RecordNavigationSave("success", PreferenceMetrics.Start());
        PreferenceMetrics.RecordNavigationSave("invalid", PreferenceMetrics.Start());
        PreferenceMetrics.RecordNavigationSave("failure", PreferenceMetrics.Start());

        Assert.Equal("Clutch.API.Preferences", PreferenceMetrics.MeterName);
        Assert.Contains("clutch.preference.navigation.save.outcomes", names);
        Assert.Contains("clutch.preference.navigation.save.duration", names);
        Assert.Equal(new[] { "success", "invalid", "failure" }, outcomes);
    }

    [Fact]
    public void Loan_payoff_timeline_save_outcomes_and_duration_are_recorded_on_the_preferences_meter()
    {
        const string counterName = "clutch.preference.loan_payoff_timeline.save.outcomes";
        const string histogramName = "clutch.preference.loan_payoff_timeline.save.duration";
        var outcomes = new List<string>();
        var durations = new List<string>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == PreferenceMetrics.MeterName
                && instrument.Name is counterName or histogramName)
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((_, _, tags, _) =>
        {
            foreach (var tag in tags)
            {
                Assert.Equal("outcome", tag.Key);
                lock (outcomes)
                {
                    outcomes.Add((string)tag.Value!);
                }
            }
        });
        listener.SetMeasurementEventCallback<double>((_, _, tags, _) =>
        {
            foreach (var tag in tags)
            {
                lock (durations)
                {
                    durations.Add((string)tag.Value!);
                }
            }
        });
        listener.Start();

        PreferenceMetrics.RecordLoanPayoffTimelineSave("success", PreferenceMetrics.Start());
        PreferenceMetrics.RecordLoanPayoffTimelineSave("superseded", PreferenceMetrics.Start());
        PreferenceMetrics.RecordLoanPayoffTimelineSave("invalid", PreferenceMetrics.Start());
        PreferenceMetrics.RecordLoanPayoffTimelineSave("failure", PreferenceMetrics.Start());

        // Other tests may record saves on the shared meter at the same time, so check membership.
        string[] expected = ["success", "superseded", "invalid", "failure"];
        lock (outcomes)
        {
            Assert.Subset(outcomes.ToHashSet(), expected.ToHashSet());
        }

        lock (durations)
        {
            Assert.Subset(durations.ToHashSet(), expected.ToHashSet());
        }
    }
}
