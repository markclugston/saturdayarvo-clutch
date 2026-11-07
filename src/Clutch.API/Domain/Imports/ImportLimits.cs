namespace Clutch.API.Domain.Imports;

public sealed record ImportLimits(
    int MaxFileSizeBytes,
    int MaxRowsPerImport,
    int MaxImportAttemptsPerUserPerMinute)
{
    public static ImportLimits Default { get; } = new(
        MaxFileSizeBytes: 10 * 1024 * 1024,
        MaxRowsPerImport: 10_000,
        MaxImportAttemptsPerUserPerMinute: 5);

    public IReadOnlyDictionary<string, string[]> Validate()
    {
        var errors = new Dictionary<string, string[]>();
        if (MaxFileSizeBytes <= 0)
        {
            errors.Add(nameof(MaxFileSizeBytes), ["Value must be positive."]);
        }

        if (MaxRowsPerImport <= 0)
        {
            errors.Add(nameof(MaxRowsPerImport), ["Value must be positive."]);
        }

        if (MaxImportAttemptsPerUserPerMinute <= 0)
        {
            errors.Add(nameof(MaxImportAttemptsPerUserPerMinute), ["Value must be positive."]);
        }

        return errors;
    }
}
