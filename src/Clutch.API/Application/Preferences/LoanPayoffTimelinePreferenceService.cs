using System.Data;
using Clutch.API.Domain.Preferences;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Preferences;

public sealed class LoanPayoffTimelinePreferenceService(
    AppDbContext dbContext,
    TimeProvider timeProvider,
    ILogger<LoanPayoffTimelinePreferenceService> logger)
{
    public async Task<LoanPayoffTimelineView> GetAsync(string userId, CancellationToken cancellationToken)
    {
        var view = await dbContext.UserLoanPayoffTimelinePreferences
            .AsNoTracking()
            .Where(preference => preference.UserId == userId)
            .Select(preference => (LoanPayoffTimelineView?)preference.View)
            .SingleOrDefaultAsync(cancellationToken);

        return view ?? LoanPayoffTimelineView.Burndown;
    }

    /// <summary>
    /// Stores the view unless a save with the same <paramref name="clientId"/> and a higher or
    /// equal <paramref name="clientSequence"/> is already stored (a later switch from the same
    /// page committed first). Returns the stored view either way.
    /// </summary>
    public async Task<LoanPayoffTimelineView> SaveAsync(
        string userId,
        LoanPayoffTimelineView view,
        Guid clientId,
        long clientSequence,
        CancellationToken cancellationToken)
    {
        var started = PreferenceMetrics.Start();
        var outcome = "failure";
        try
        {
            var strategy = dbContext.Database.CreateExecutionStrategy();
            var (saved, superseded) = await strategy.ExecuteAsync(async () =>
            {
                dbContext.ChangeTracker.Clear();
                await using var transaction = await dbContext.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable,
                    cancellationToken);

                var preference = await dbContext.UserLoanPayoffTimelinePreferences
                    .SingleOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
                if (preference is not null && preference.IsSupersededBy(clientId, clientSequence))
                {
                    await transaction.CommitAsync(cancellationToken);
                    return (preference.View, true);
                }

                var updatedAtUtc = timeProvider.GetUtcNow();
                if (preference is null)
                {
                    preference = UserLoanPayoffTimelinePreference.Create(
                        userId,
                        view,
                        clientId,
                        clientSequence,
                        updatedAtUtc);
                    dbContext.UserLoanPayoffTimelinePreferences.Add(preference);
                }
                else
                {
                    preference.Update(view, clientId, clientSequence, updatedAtUtc);
                }

                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return (preference.View, false);
            });
            outcome = superseded ? "superseded" : "success";
            return saved;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Saving the loan payoff timeline preference failed.");
            throw;
        }
        finally
        {
            PreferenceMetrics.RecordLoanPayoffTimelineSave(outcome, started);
        }
    }
}
