using System.Data;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Assets;
using Clutch.API.Domain.Audit;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Clutch.API.Application.Assets;

// Either the lease that was taken, or the status of the edit that blocks it.
public sealed record AcquireResult(EditLeaseResponse? Lease, EditStatusResponse? Blocked);

// The single edit lease of an asset (spec FR-020), after the account import lease.
public sealed class AssetEditService(
    AppDbContext dbContext,
    AssetService assetService,
    TimeProvider timeProvider,
    ILogger<AssetEditService> logger)
{
    // How long finished edits are kept so a returning session can learn what happened.
    private static readonly TimeSpan TerminalRetention = TimeSpan.FromHours(24);

    public async Task<AcquireResult> AcquireAsync(
        string ownerUserId,
        Guid assetId,
        CancellationToken cancellationToken)
    {
        var started = AssetMetrics.Start();
        var outcome = "failure";
        try
        {
            var (result, persistedExpiry) = await InTransactionAsync(
                async transaction =>
                {
                    if (!await dbContext.LockAssetAsync(ownerUserId, assetId, cancellationToken))
                    {
                        outcome = "not_found";
                        throw AssetProblems.NotFound();
                    }

                    var now = timeProvider.GetUtcNow();
                    var pointer = await dbContext.ActiveEditIdAsync(assetId, cancellationToken);
                    var current = pointer is null
                        ? null
                        : await dbContext.AssetEdits
                            .AsNoTracking()
                            .SingleOrDefaultAsync(
                                edit => edit.Id == pointer && edit.AssetId == assetId,
                                cancellationToken);
                    if (current is not null && current.IsActiveAt(now))
                    {
                        dbContext.Audits.Add(new Audit(
                            ownerUserId,
                            now,
                            "AssetEditRejected",
                            AssetAuditText.EditRejected(assetId, ownerUserId, current.Id)));
                        await dbContext.SaveChangesAsync(cancellationToken);
                        await transaction.CommitAsync(cancellationToken);
                        var blocked = new EditStatusResponse(
                            assetId,
                            "Blocked",
                            new ActiveEditResponse(current.Id, current.ExpiresAtUtc),
                            null);
                        return (new AcquireResult(null, blocked), false);
                    }

                    var expired = current is not null
                        && current.TryExpire(now)
                        && await dbContext.TryPersistTransitionAsync(current, cancellationToken);
                    var edit = AssetEdit.Open(assetId, ownerUserId, now);
                    if (!await dbContext.TryMovePointerAsync(assetId, pointer, edit.Id, cancellationToken))
                    {
                        throw AssetProblems.EditChanged();
                    }

                    var cutoff = now - TerminalRetention;
                    await dbContext.AssetEdits
                        .Where(row => row.AssetId == assetId
                            && row.State != AssetEditState.Active
                            && (row.EndedAtUtc ?? row.OpenedAtUtc) < cutoff)
                        .ExecuteDeleteAsync(cancellationToken);
                    dbContext.AssetEdits.Add(edit);
                    await dbContext.SaveChangesAsync(cancellationToken);
                    var detail = await assetService.GetDetailAsync(ownerUserId, assetId, cancellationToken)
                        ?? throw AssetProblems.NotFound();
                    await transaction.CommitAsync(cancellationToken);
                    var lease = new EditLeaseResponse(edit.Id, edit.ExpiresAtUtc, now, detail);
                    return (new AcquireResult(lease, null), expired);
                },
                cancellationToken);

            // Counted only once the transition is committed.
            if (persistedExpiry)
            {
                AssetMetrics.RecordExpired("acquire");
            }

            if (result.Lease is { } acquired)
            {
                outcome = "success";
                logger.LogInformation("Edit {EditId} of asset {AssetId} was opened.", acquired.EditId, assetId);
            }
            else
            {
                outcome = "blocked";
                logger.LogInformation(
                    "An edit of asset {AssetId} was refused because edit {EditId} is active.",
                    assetId,
                    result.Blocked!.ActiveEdit!.Id);
            }

            return result;
        }
        finally
        {
            AssetMetrics.RecordAcquire(outcome, started);
        }
    }

    // Read only: an expired edit is reported as expired without being marked.
    public async Task<EditStatusResponse> GetStatusAsync(
        string ownerUserId,
        Guid assetId,
        Guid? watchedEditId,
        CancellationToken cancellationToken)
    {
        var started = AssetMetrics.Start();
        var outcome = "failure";
        try
        {
            // One statement, so the pointer and the edits are read together. Only this asset's
            // active and watched rows are joined, by a seek on AssetId.
            var projection = await dbContext.Assets
                .AsNoTracking()
                .Where(asset => asset.Id == assetId && asset.OwnerUserId == ownerUserId)
                .Select(asset => new
                {
                    asset.ActiveEditId,
                    Edits = dbContext.AssetEdits
                        .Where(edit => edit.AssetId == asset.Id
                            && (edit.Id == asset.ActiveEditId || edit.Id == watchedEditId))
                        .Select(edit => new
                        {
                            edit.Id,
                            edit.State,
                            edit.ExpiresAtUtc,
                            edit.EndedAtUtc,
                            edit.EndedByUserId,
                            EndedByUserName = dbContext.Users
                                .Where(user => user.Id == edit.EndedByUserId)
                                .Select(user => user.UserName)
                                .FirstOrDefault(),
                        })
                        .ToList(),
                })
                .SingleOrDefaultAsync(cancellationToken);
            if (projection is null)
            {
                outcome = "not_found";
                throw AssetProblems.NotFound();
            }

            var now = timeProvider.GetUtcNow();
            var held = projection.Edits.SingleOrDefault(edit => edit.Id == projection.ActiveEditId);
            var active = held is not null && AssetEdit.IsStillActive(held.State, held.ExpiresAtUtc, now)
                ? new ActiveEditResponse(held.Id, held.ExpiresAtUtc)
                : null;

            WatchedEditResponse? watched = null;
            if (watchedEditId is { } id)
            {
                var row = projection.Edits.SingleOrDefault(edit => edit.Id == id);
                if (row is null)
                {
                    watched = new WatchedEditResponse(id, "Unavailable");
                }
                else if (AssetEdit.IsStillActive(row.State, row.ExpiresAtUtc, now))
                {
                    watched = new WatchedEditResponse(id, nameof(AssetEditState.Active), row.ExpiresAtUtc);
                }
                else if (AssetEdit.HasExpired(row.State, row.ExpiresAtUtc, now))
                {
                    watched = new WatchedEditResponse(id, nameof(AssetEditState.Expired));
                }
                else if (row.State == AssetEditState.Ended)
                {
                    if (row.EndedByUserId is null || string.IsNullOrWhiteSpace(row.EndedByUserName))
                    {
                        throw AssetProblems.StatusUnavailable();
                    }

                    watched = new WatchedEditResponse(
                        id,
                        nameof(AssetEditState.Ended),
                        EndedAtUtc: row.EndedAtUtc,
                        EndedBy: new EditEndingUserResponse(row.EndedByUserId, row.EndedByUserName));
                }
                else
                {
                    watched = new WatchedEditResponse(id, row.State.ToString());
                }
            }

            outcome = active is null ? "available" : "blocked";
            return new EditStatusResponse(
                assetId,
                active is null ? "Available" : "Blocked",
                active,
                watched);
        }
        finally
        {
            AssetMetrics.RecordStatus(outcome, started);
        }
    }

    // Ends exactly the named edit for another session; never a newer one.
    public async Task EndAsync(
        string ownerUserId,
        Guid assetId,
        Guid editId,
        CancellationToken cancellationToken)
    {
        var started = AssetMetrics.Start();
        var outcome = "failure";
        try
        {
            await InTransactionAsync(
                async transaction =>
                {
                    if (!await dbContext.LockAssetAsync(ownerUserId, assetId, cancellationToken))
                    {
                        outcome = "not_found";
                        throw AssetProblems.NotFound();
                    }

                    var edit = await FindEditAsync(assetId, editId, cancellationToken);
                    if (edit is null)
                    {
                        outcome = "not_found";
                        throw AssetProblems.EditNotFound();
                    }

                    // A repeat of an end that already happened succeeds and writes nothing.
                    if (edit.State == AssetEditState.Ended)
                    {
                        return true;
                    }

                    var now = timeProvider.GetUtcNow();
                    if (!edit.TryEnd(ownerUserId, now)
                        || !await dbContext.TryMovePointerAsync(assetId, editId, null, cancellationToken)
                        || !await dbContext.TryPersistTransitionAsync(edit, cancellationToken))
                    {
                        outcome = "changed";
                        throw AssetProblems.EditChanged();
                    }

                    dbContext.Audits.Add(new Audit(
                        ownerUserId,
                        now,
                        "AssetEditEnded",
                        AssetAuditText.EditEnded(assetId, editId, ownerUserId)));
                    await dbContext.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    return true;
                },
                cancellationToken);

            outcome = "success";
            logger.LogInformation("Edit {EditId} of asset {AssetId} was ended.", editId, assetId);
        }
        catch (ApiProblemException exception)
        {
            logger.LogInformation(
                "Ending an edit of asset {AssetId} was rejected with status {StatusCode}.",
                assetId,
                exception.StatusCode);
            throw;
        }
        finally
        {
            AssetMetrics.RecordEnd(outcome, started);
        }
    }

    // The holder gives up its edit. Idempotent: a finished edit is left as it is.
    public async Task ReleaseAsync(
        string ownerUserId,
        Guid assetId,
        Guid editId,
        CancellationToken cancellationToken)
    {
        var released = await InTransactionAsync(
            async transaction =>
            {
                if (!await dbContext.LockAssetAsync(ownerUserId, assetId, cancellationToken))
                {
                    throw AssetProblems.NotFound();
                }

                var edit = await FindEditAsync(assetId, editId, cancellationToken)
                    ?? throw AssetProblems.EditNotFound();
                if (!edit.TryRelease(timeProvider.GetUtcNow())
                    || !await dbContext.TryPersistTransitionAsync(edit, cancellationToken))
                {
                    return null;
                }

                await dbContext.TryMovePointerAsync(assetId, editId, null, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return edit;
            },
            cancellationToken);

        if (released is null)
        {
            return;
        }

        if (released.State == AssetEditState.Expired)
        {
            AssetMetrics.RecordExpired("release");
        }

        logger.LogInformation(
            "Edit {EditId} of asset {AssetId} finished as {State}.",
            editId,
            assetId,
            released.State);
    }

    private Task<AssetEdit?> FindEditAsync(Guid assetId, Guid editId, CancellationToken cancellationToken) =>
        dbContext.AssetEdits
            .AsNoTracking()
            .SingleOrDefaultAsync(edit => edit.Id == editId && edit.AssetId == assetId, cancellationToken);

    // Work that returns without committing is rolled back when the transaction is disposed.
    private Task<T> InTransactionAsync<T>(
        Func<IDbContextTransaction, Task<T>> work,
        CancellationToken cancellationToken) =>
        dbContext.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            return await work(transaction);
        });
}
