using Clutch.API.Domain.Imports;

namespace Clutch.API.Infrastructure.Persistence.Entities;

public sealed class ImportLimitSettings
{
    private ImportLimitSettings()
    {
    }

    private ImportLimitSettings(
        ImportLimits limits,
        string updatedByUserId,
        DateTimeOffset updatedAtUtc)
    {
        MaxFileSizeBytes = limits.MaxFileSizeBytes;
        MaxRowsPerImport = limits.MaxRowsPerImport;
        MaxImportAttemptsPerUserPerMinute = limits.MaxImportAttemptsPerUserPerMinute;
        UpdatedByUserId = updatedByUserId;
        UpdatedAtUtc = updatedAtUtc;
    }

    public int Id { get; private set; } = 1;

    public int MaxFileSizeBytes { get; private set; }

    public int MaxRowsPerImport { get; private set; }

    public int MaxImportAttemptsPerUserPerMinute { get; private set; }

    public string UpdatedByUserId { get; private set; } = string.Empty;

    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public static ImportLimitSettings Create(
        ImportLimits limits,
        string updatedByUserId,
        DateTimeOffset updatedAtUtc) =>
        new(limits, updatedByUserId, updatedAtUtc);

    public ImportLimits ToDomain() =>
        new(MaxFileSizeBytes, MaxRowsPerImport, MaxImportAttemptsPerUserPerMinute);

    public void Update(ImportLimits limits, string updatedByUserId, DateTimeOffset updatedAtUtc)
    {
        MaxFileSizeBytes = limits.MaxFileSizeBytes;
        MaxRowsPerImport = limits.MaxRowsPerImport;
        MaxImportAttemptsPerUserPerMinute = limits.MaxImportAttemptsPerUserPerMinute;
        UpdatedByUserId = updatedByUserId;
        UpdatedAtUtc = updatedAtUtc;
    }
}
