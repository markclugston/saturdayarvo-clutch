using Clutch.API.Domain.Audit;
using Clutch.API.Infrastructure.Persistence;

namespace Clutch.API.Infrastructure.Imports;

public sealed class ImportAuditWriter(AppDbContext dbContext, TimeProvider timeProvider)
{
    public void Add(
        string accountDescription,
        string actingUserId,
        string eventCode,
        DateTimeOffset? occurredAtUtc = null)
    {
        if (string.IsNullOrWhiteSpace(accountDescription))
        {
            throw new ArgumentException("The account description is required.", nameof(accountDescription));
        }

        dbContext.Audits.Add(new Audit(
            actingUserId,
            occurredAtUtc ?? timeProvider.GetUtcNow(),
            eventCode,
            $"Import {eventCode} for account {accountDescription}."));
    }

    public async Task WriteAsync(
        string accountDescription,
        string actingUserId,
        string eventCode,
        CancellationToken cancellationToken)
    {
        Add(accountDescription, actingUserId, eventCode);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
