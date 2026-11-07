using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Infrastructure.Imports;

public sealed class AccountImportLease(AppDbContext dbContext)
{
    public async Task<bool> TryAcquireAsync(
        Guid accountId,
        Guid reviewId,
        CancellationToken cancellationToken)
    {
        var updated = await dbContext.Accounts
            .Where(account => account.Id == accountId && account.ActiveImportId == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(account => account.ActiveImportId, reviewId),
                cancellationToken);
        return updated == 1;
    }

    public async Task<bool> ReleaseAsync(
        Guid accountId,
        Guid reviewId,
        CancellationToken cancellationToken)
    {
        var updated = await dbContext.Accounts
            .Where(account => account.Id == accountId && account.ActiveImportId == reviewId)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(account => account.ActiveImportId, (Guid?)null),
                cancellationToken);
        return updated == 1;
    }
}
