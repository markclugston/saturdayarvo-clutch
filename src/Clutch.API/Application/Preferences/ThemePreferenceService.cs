using System.Data;
using Clutch.API.Domain.Preferences;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Preferences;

public sealed class ThemePreferenceService(
    AppDbContext dbContext,
    TimeProvider timeProvider)
{
    public async Task<ThemeMode> GetAsync(string userId, CancellationToken cancellationToken)
    {
        var mode = await dbContext.UserThemePreferences
            .AsNoTracking()
            .Where(preference => preference.UserId == userId)
            .Select(preference => (ThemeMode?)preference.Mode)
            .SingleOrDefaultAsync(cancellationToken);

        return mode ?? ThemeMode.Light;
    }

    public async Task<ThemeMode> SaveAsync(
        string userId,
        ThemeMode mode,
        CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

            var preference = await dbContext.UserThemePreferences
                .SingleOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
            var updatedAtUtc = timeProvider.GetUtcNow();
            if (preference is null)
            {
                preference = UserThemePreference.Create(userId, mode, updatedAtUtc);
                dbContext.UserThemePreferences.Add(preference);
            }
            else
            {
                preference.Update(mode, updatedAtUtc);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return preference.Mode;
        });
    }
}
