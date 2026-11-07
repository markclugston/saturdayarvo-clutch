using Clutch.API.Domain.Imports;

namespace Clutch.API.Tests.Unit.Imports;

public sealed class ImportLimitsTests
{
    [Fact]
    public void Default_uses_the_configured_shared_limits()
    {
        Assert.Equal(10 * 1024 * 1024, ImportLimits.Default.MaxFileSizeBytes);
        Assert.Equal(10_000, ImportLimits.Default.MaxRowsPerImport);
        Assert.Equal(5, ImportLimits.Default.MaxImportAttemptsPerUserPerMinute);
    }

    [Fact]
    public void Validate_reports_all_non_positive_values_together()
    {
        var limits = new ImportLimits(0, -1, 0);

        var errors = limits.Validate();

        Assert.Equal(3, errors.Count);
        Assert.Contains(nameof(ImportLimits.MaxFileSizeBytes), errors.Keys);
        Assert.Contains(nameof(ImportLimits.MaxRowsPerImport), errors.Keys);
        Assert.Contains(nameof(ImportLimits.MaxImportAttemptsPerUserPerMinute), errors.Keys);
    }

    [Fact]
    public void Validate_accepts_positive_values()
    {
        var errors = new ImportLimits(1, 1, 1).Validate();

        Assert.Empty(errors);
    }
}
