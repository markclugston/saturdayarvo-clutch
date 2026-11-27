using Clutch.API.Domain.Assets;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Assets;

// The conditional updates of the edit lease. Every writer first locks the asset row, so acquire,
// save, end, release and delete are serialized per asset and take locks in the same order.
internal static class AssetLeaseStore
{
    // A no-op update holds an exclusive row lock until the transaction ends. False when the asset
    // is not this owner's, including when it has been deleted.
    public static async Task<bool> LockAssetAsync(
        this AppDbContext dbContext,
        string ownerUserId,
        Guid assetId,
        CancellationToken cancellationToken) =>
        await dbContext.Assets
            .Where(asset => asset.Id == assetId && asset.OwnerUserId == ownerUserId)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(asset => asset.ActiveEditId, asset => asset.ActiveEditId),
                cancellationToken) == 1;

    public static Task<Guid?> ActiveEditIdAsync(
        this AppDbContext dbContext,
        Guid assetId,
        CancellationToken cancellationToken) =>
        dbContext.Assets
            .AsNoTracking()
            .Where(asset => asset.Id == assetId)
            .Select(asset => asset.ActiveEditId)
            .SingleAsync(cancellationToken);

    // Stores a transition already applied to a detached edit, only while the row is still Active.
    public static async Task<bool> TryPersistTransitionAsync(
        this AppDbContext dbContext,
        AssetEdit edit,
        CancellationToken cancellationToken) =>
        await dbContext.AssetEdits
            .Where(row => row.Id == edit.Id && row.State == AssetEditState.Active)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(row => row.State, edit.State)
                    .SetProperty(row => row.EndedByUserId, edit.EndedByUserId)
                    .SetProperty(row => row.EndedAtUtc, edit.EndedAtUtc),
                cancellationToken) == 1;

    // Moves the lease pointer only if it still holds the expected value.
    public static async Task<bool> TryMovePointerAsync(
        this AppDbContext dbContext,
        Guid assetId,
        Guid? expected,
        Guid? next,
        CancellationToken cancellationToken) =>
        await dbContext.Assets
            .Where(asset => asset.Id == assetId && asset.ActiveEditId == expected)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(asset => asset.ActiveEditId, next),
                cancellationToken) == 1;
}
