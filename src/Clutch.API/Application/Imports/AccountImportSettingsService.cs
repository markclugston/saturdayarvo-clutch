using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Accounts;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Imports;

public sealed class AccountImportSettingsService(
    AppDbContext dbContext,
    TimeProvider timeProvider,
    ILogger<AccountImportSettingsService> logger)
{
    public async Task<AccountImportSettingsResponse> GetAsync(
        string ownerUserId,
        Guid accountId,
        CancellationToken cancellationToken)
    {
        var ownedAccount = await (
            from account in dbContext.Accounts.AsNoTracking()
            join settings in dbContext.AccountImportSettings.AsNoTracking()
                on account.Id equals settings.AccountId into accountSettings
            from settings in accountSettings.DefaultIfEmpty()
            where account.Id == accountId && account.OwnerUserId == ownerUserId
            select new StoredSettingsResult(
                account.Id,
                settings == null ? null : settings.SchemaVersion,
                settings == null ? null : settings.SettingsJson))
            .SingleOrDefaultAsync(cancellationToken);

        if (ownedAccount is null)
        {
            throw new ApiProblemException(
                StatusCodes.Status404NotFound,
                "Account not found.",
                "The account does not exist or is not available to this user.");
        }

        if (ownedAccount.SchemaVersion is null || ownedAccount.SettingsJson is null)
        {
            return new AccountImportSettingsResponse(null);
        }

        return new AccountImportSettingsResponse(
            ImportMappingSettingsSerializer.Deserialize(
                ownedAccount.SchemaVersion.Value,
                ownedAccount.SettingsJson));
    }

    public async Task SaveAsync(
        Guid accountId,
        ImportMapping mapping,
        CancellationToken cancellationToken)
    {
        var startedAtTimestamp = ImportMetrics.StartSettingsSave();
        var settingsJson = ImportMappingSettingsSerializer.Serialize(mapping);
        try
        {
            var currentState = await (
                from account in dbContext.Accounts
                join storedSettings in dbContext.AccountImportSettings
                    on account.Id equals storedSettings.AccountId into accountSettings
                from storedSettings in accountSettings.DefaultIfEmpty()
                where account.Id == accountId
                select new
                {
                    Settings = storedSettings,
                })
                .SingleOrDefaultAsync(cancellationToken);
            if (currentState is null)
            {
                throw new ApiProblemException(
                    StatusCodes.Status404NotFound,
                    "Account not found.",
                    "The account does not exist or is not available.");
            }

            var settings = currentState.Settings;
            if (settings is null)
            {
                settings = AccountImportSettings.Create(
                    accountId,
                    ImportMappingSettingsSerializer.CurrentSchemaVersion,
                    settingsJson,
                    timeProvider.GetUtcNow());
                dbContext.AccountImportSettings.Add(settings);
            }
            else
            {
                settings.Update(
                    ImportMappingSettingsSerializer.CurrentSchemaVersion,
                    settingsJson,
                    timeProvider.GetUtcNow());
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            ImportMetrics.RecordSettingsSave("success", startedAtTimestamp);
        }
        catch (Exception exception) when (exception is DbUpdateException or SqlException)
        {
            logger.LogWarning("Import settings could not be saved as part of the import transaction.");
            ImportMetrics.RecordSettingsSave("failed", startedAtTimestamp);
            throw;
        }
    }

    private sealed record StoredSettingsResult(
        Guid AccountId,
        int? SchemaVersion,
        string? SettingsJson);
}

public sealed record AccountImportSettingsResponse(ImportMapping? Mapping);
