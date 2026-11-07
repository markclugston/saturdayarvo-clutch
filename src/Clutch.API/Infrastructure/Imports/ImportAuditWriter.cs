using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Persistence;

namespace Clutch.API.Infrastructure.Imports;

public sealed class ImportAuditWriter(AppDbContext dbContext, TimeProvider timeProvider)
{
    public void Add(
        Guid? reviewId,
        Guid accountId,
        string actingUserId,
        string eventCode,
        DateTimeOffset? occurredAtUtc = null)
    {
        dbContext.ImportAuditEvents.Add(new ImportAuditEvent(
            reviewId,
            accountId,
            actingUserId,
            eventCode,
            occurredAtUtc ?? timeProvider.GetUtcNow()));
    }

    public async Task WriteAsync(
        Guid accountId,
        string actingUserId,
        string eventCode,
        CancellationToken cancellationToken)
    {
        Add(null, accountId, actingUserId, eventCode);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
