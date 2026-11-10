using System.Data;
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

    public async Task<bool> SaveAfterConfirmationAsync(
        Guid accountId,
        Guid reviewId,
        ImportMapping mapping,
        CancellationToken cancellationToken)
    {
        var startedAtTimestamp = ImportMetrics.StartSettingsSave();
        var settingsJson = ImportMappingSettingsSerializer.Serialize(mapping);
        var strategy = dbContext.Database.CreateExecutionStrategy();
        try
        {
            return await strategy.ExecuteAsync(async () =>
            {
                dbContext.ChangeTracker.Clear();
                await using var transaction = await dbContext.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable,
                    cancellationToken);

                var currentState = await (
                    from account in dbContext.Accounts
                    join storedSettings in dbContext.AccountImportSettings
                        on account.Id equals storedSettings.AccountId into accountSettings
                    from storedSettings in accountSettings.DefaultIfEmpty()
                    where account.Id == accountId
                    select new
                    {
                        account.LastSuccessfulImportReviewId,
                        Settings = storedSettings,
                    })
                    .SingleOrDefaultAsync(cancellationToken);
                if (currentState is null || currentState.LastSuccessfulImportReviewId != reviewId)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    ImportMetrics.RecordSettingsSave("stale", startedAtTimestamp);
                    return false;
                }

                var settings = currentState.Settings;
                if (settings is null)
                {
                    settings = AccountImportSettings.Create(
                        accountId,
                        ImportMappingSettingsSerializer.CurrentSchemaVersion,
                        settingsJson,
                        reviewId,
                        timeProvider.GetUtcNow());
                    dbContext.AccountImportSettings.Add(settings);
                }
                else
                {
                    settings.Update(
                        ImportMappingSettingsSerializer.CurrentSchemaVersion,
                        settingsJson,
                        reviewId,
                        timeProvider.GetUtcNow());
                }

                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                ImportMetrics.RecordSettingsSave("success", startedAtTimestamp);
                return true;
            });
        }
        catch (Exception exception) when (exception is DbUpdateException or SqlException)
        {
            dbContext.ChangeTracker.Clear();
            logger.LogWarning("Import settings could not be saved after a successful transaction import.");
            ImportMetrics.RecordSettingsSave("failed", startedAtTimestamp);
            return false;
        }
    }

    private sealed record StoredSettingsResult(
        Guid AccountId,
        int? SchemaVersion,
        string? SettingsJson);
}

public sealed record AccountImportSettingsResponse(ImportMapping? Mapping);
