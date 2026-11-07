namespace Clutch.API.Infrastructure.Persistence.Entities;

public sealed class AccountImportSettings
{
    private AccountImportSettings()
    {
    }

    private AccountImportSettings(
        Guid accountId,
        int schemaVersion,
        string settingsJson,
        Guid sourceImportReviewId,
        DateTimeOffset savedAtUtc)
    {
        AccountId = accountId;
        SchemaVersion = schemaVersion;
        SettingsJson = settingsJson;
        SourceImportReviewId = sourceImportReviewId;
        SavedAtUtc = savedAtUtc;
    }

    public Guid AccountId { get; private set; }

    public int SchemaVersion { get; private set; }

    public string SettingsJson { get; private set; } = string.Empty;

    public Guid SourceImportReviewId { get; private set; }

    public DateTimeOffset SavedAtUtc { get; private set; }

    public static AccountImportSettings Create(
        Guid accountId,
        int schemaVersion,
        string settingsJson,
        Guid sourceImportReviewId,
        DateTimeOffset savedAtUtc) =>
        new(accountId, schemaVersion, settingsJson, sourceImportReviewId, savedAtUtc);

    public void Update(
        int schemaVersion,
        string settingsJson,
        Guid sourceImportReviewId,
        DateTimeOffset savedAtUtc)
    {
        SchemaVersion = schemaVersion;
        SettingsJson = settingsJson;
        SourceImportReviewId = sourceImportReviewId;
        SavedAtUtc = savedAtUtc;
    }
}
