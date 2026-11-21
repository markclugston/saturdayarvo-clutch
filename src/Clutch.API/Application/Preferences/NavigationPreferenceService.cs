using System.Data;
using Clutch.API.Domain.Preferences;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Preferences;

public sealed class NavigationPreferenceService(
    AppDbContext dbContext,
    TimeProvider timeProvider,
    ILogger<NavigationPreferenceService> logger)
{
    public async Task<NavigationState> GetAsync(string userId, CancellationToken cancellationToken)
    {
        var state = await dbContext.UserNavigationPreferences
            .AsNoTracking()
            .Where(preference => preference.UserId == userId)
            .Select(preference => (NavigationState?)preference.State)
            .SingleOrDefaultAsync(cancellationToken);

        return state ?? NavigationState.Unpinned;
    }

    public async Task<NavigationState> SaveAsync(
        string userId,
        NavigationState state,
        CancellationToken cancellationToken)
    {
        var started = PreferenceMetrics.Start();
        var outcome = "failure";
        try
        {
            var strategy = dbContext.Database.CreateExecutionStrategy();
            var saved = await strategy.ExecuteAsync(async () =>
            {
                dbContext.ChangeTracker.Clear();
                await using var transaction = await dbContext.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable,
                    cancellationToken);

                var preference = await dbContext.UserNavigationPreferences
                    .SingleOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
                var updatedAtUtc = timeProvider.GetUtcNow();
                if (preference is null)
                {
                    preference = UserNavigationPreference.Create(userId, state, updatedAtUtc);
                    dbContext.UserNavigationPreferences.Add(preference);
                }
                else
                {
                    preference.Update(state, updatedAtUtc);
                }

                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return preference.State;
            });
            outcome = "success";
            return saved;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Saving the navigation preference failed.");
            throw;
        }
        finally
        {
            PreferenceMetrics.RecordNavigationSave(outcome, started);
        }
    }
}
