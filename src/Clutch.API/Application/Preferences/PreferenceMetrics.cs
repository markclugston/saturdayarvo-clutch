using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Clutch.API.Application.Preferences;

public static class PreferenceMetrics
{
    public const string MeterName = "Clutch.API.Preferences";

    private static readonly Meter Meter = new(MeterName, "1.0.0");
    private static readonly Counter<long> NavigationSaveOutcomes =
        Meter.CreateCounter<long>("clutch.preference.navigation.save.outcomes", "{save}");
    private static readonly Histogram<double> NavigationSaveDuration =
        Meter.CreateHistogram<double>("clutch.preference.navigation.save.duration", "ms");

    private static readonly Counter<long> LoanPayoffTimelineSaveOutcomes =
        Meter.CreateCounter<long>("clutch.preference.loan_payoff_timeline.save.outcomes", "{save}");
    private static readonly Histogram<double> LoanPayoffTimelineSaveDuration =
        Meter.CreateHistogram<double>("clutch.preference.loan_payoff_timeline.save.duration", "ms");

    public static long Start() => Stopwatch.GetTimestamp();

    // outcome: success | superseded | invalid | failure.
    public static void RecordLoanPayoffTimelineSave(string outcome, long startedAtTimestamp)
    {
        var tags = new KeyValuePair<string, object?>("outcome", outcome);
        LoanPayoffTimelineSaveOutcomes.Add(1, tags);
        LoanPayoffTimelineSaveDuration.Record(
            Stopwatch.GetElapsedTime(startedAtTimestamp).TotalMilliseconds,
            tags);
    }

    // outcome: success | invalid | failure.
    public static void RecordNavigationSave(string outcome, long startedAtTimestamp)
    {
        var tags = new KeyValuePair<string, object?>("outcome", outcome);
        NavigationSaveOutcomes.Add(1, tags);
        NavigationSaveDuration.Record(Stopwatch.GetElapsedTime(startedAtTimestamp).TotalMilliseconds, tags);
    }
}
