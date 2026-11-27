using System.Data;
using System.Globalization;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Assets;
using Clutch.API.Domain.Audit;
using Clutch.API.Domain.Shared;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Assets;

// Logs carry ids and status codes only: names, descriptions and values are financial data.
public sealed class AssetService(
    AppDbContext dbContext,
    TimeProvider timeProvider,
    ILogger<AssetService> logger)
{
    public async Task<AssetListResponse> ListAsync(
        string ownerUserId,
        CancellationToken cancellationToken)
    {
        // One query: each latest value is an index seek on (AssetId, ValuationDate DESC).
        var rows = await dbContext.Assets
            .AsNoTracking()
            .Where(asset => asset.OwnerUserId == ownerUserId)
            .OrderBy(asset => asset.CreatedAtUtc)
            .ThenBy(asset => asset.Id)
            .Select(asset => new
            {
                asset.Id,
                asset.Name,
                asset.Description,
                asset.CurrencyCode,
                Value = asset.Valuations
                    .OrderByDescending(valuation => valuation.ValuationDate)
                    .Select(valuation => valuation.Value)
                    .First(),
                ValuationDate = asset.Valuations
                    .OrderByDescending(valuation => valuation.ValuationDate)
                    .Select(valuation => valuation.ValuationDate)
                    .First(),
            })
            .ToListAsync(cancellationToken);

        var totals = rows
            .GroupBy(row => row.CurrencyCode, StringComparer.Ordinal)
            .OrderBy(group => group.Key, StringComparer.Ordinal)
            .Select(group => new CurrencyTotalResponse(
                group.Key,
                FormatTotal(group.Sum(row => row.Value), group.Key)))
            .ToList();

        return new AssetListResponse(
            rows.Select(row => new AssetListItemResponse(
                    row.Id,
                    row.Name,
                    row.Description,
                    row.CurrencyCode,
                    new LatestValuationResponse(row.Value, AssetDates.Format(row.ValuationDate))))
                .ToList(),
            totals);
    }

    // The detail an edit lease returns; there is no endpoint that reads an asset by id.
    public async Task<AssetDetailResponse?> GetDetailAsync(
        string ownerUserId,
        Guid assetId,
        CancellationToken cancellationToken)
    {
        var asset = await dbContext.Assets
            .AsNoTracking()
            .Include(item => item.Valuations)
            .SingleOrDefaultAsync(
                item => item.Id == assetId && item.OwnerUserId == ownerUserId,
                cancellationToken);
        return asset is null ? null : AssetDetailResponse.From(asset);
    }

    public async Task<AssetDetailResponse> CreateAsync(
        string ownerUserId,
        AssetCandidate candidate,
        CancellationToken cancellationToken)
    {
        var started = AssetMetrics.Start();
        var outcome = "failure";
        try
        {
            var result = AssetValidator.Validate(candidate, timeProvider);
            if (result.Value is not { } valid)
            {
                outcome = "invalid";
                throw AssetProblems.Invalid(result.Errors);
            }

            // A new asset has no stored valuations, so any supplied id is unknown.
            var diff = AssetValuationDiff.Compare([], valid.Valuations);
            if (diff.Errors.Count > 0)
            {
                outcome = "invalid";
                throw AssetProblems.Invalid(diff.Errors);
            }

            var strategy = dbContext.Database.CreateExecutionStrategy();
            var created = await strategy.ExecuteAsync(async () =>
            {
                dbContext.ChangeTracker.Clear();
                var now = timeProvider.GetUtcNow();
                var asset = Asset.Create(ownerUserId, valid, now);
                dbContext.Assets.Add(asset);
                dbContext.Audits.Add(new Audit(
                    ownerUserId,
                    now,
                    "AssetCreate",
                    AssetAuditText.Created(asset.Id, DetailsOf(asset), AuditValuations(asset.Valuations))));
                // One SaveChanges is one transaction: asset, valuations and audit row together.
                await dbContext.SaveChangesAsync(cancellationToken);
                return asset;
            });

            outcome = "success";
            logger.LogInformation("Asset {AssetId} was created.", created.Id);
            return AssetDetailResponse.From(created);
        }
        catch (ApiProblemException exception)
        {
            logger.LogInformation("An asset create was rejected with status {StatusCode}.", exception.StatusCode);
            throw;
        }
        finally
        {
            AssetMetrics.RecordSave("create", outcome, started);
        }
    }

    public async Task<AssetDetailResponse> SaveAsync(
        string ownerUserId,
        Guid assetId,
        Guid? editId,
        AssetCandidate candidate,
        CancellationToken cancellationToken)
    {
        var started = AssetMetrics.Start();
        var outcome = "failure";
        try
        {
            // Validate before any database work, so a rejected Save leaves the edit untouched.
            var result = AssetValidator.Validate(candidate, timeProvider);
            var errors = new Dictionary<string, string>(result.Errors);
            if (editId is null || editId == Guid.Empty)
            {
                errors["editId"] = "Provide the edit being saved";
            }

            if (result.Value is not { } valid || errors.Count > 0)
            {
                outcome = "invalid";
                throw AssetProblems.Invalid(errors);
            }

            var strategy = dbContext.Database.CreateExecutionStrategy();
            var saved = await strategy.ExecuteAsync(async () =>
            {
                dbContext.ChangeTracker.Clear();
                await using var transaction = await dbContext.Database.BeginTransactionAsync(
                    IsolationLevel.ReadCommitted,
                    cancellationToken);
                if (!await dbContext.LockAssetAsync(ownerUserId, assetId, cancellationToken))
                {
                    outcome = "not_found";
                    throw AssetProblems.NotFound();
                }

                var now = timeProvider.GetUtcNow();
                outcome = await ClaimEditAsync(assetId, editId!.Value, now, cancellationToken);
                if (outcome != "success")
                {
                    throw outcome switch
                    {
                        "ended" => AssetProblems.EditEnded(),
                        "expired" => AssetProblems.EditExpired(),
                        _ => AssetProblems.EditChanged(),
                    };
                }

                outcome = "failure";
                var asset = await dbContext.Assets
                    .Include(item => item.Valuations)
                    .SingleAsync(item => item.Id == assetId, cancellationToken);
                var diff = AssetValuationDiff.Compare(asset.Valuations, valid.Valuations);
                var rejected = new Dictionary<string, string>(diff.Errors);
                if (!string.Equals(valid.Currency.Code, asset.CurrencyCode, StringComparison.Ordinal))
                {
                    rejected["currencyCode"] = Asset.CurrencyFixedMessage;
                }

                if (rejected.Count > 0)
                {
                    outcome = "invalid";
                    // Leaving without a commit rolls the claim back: the edit stays active.
                    throw AssetProblems.Invalid(rejected);
                }

                var before = DetailsOf(asset);
                var removed = AuditValuations(diff.Removed);
                asset.Update(valid);
                foreach (var valuation in diff.Removed)
                {
                    asset.RemoveValuation(valuation);
                }

                var added = diff.Added
                    .Select(item => asset.AddValuation(item.Value, item.ValuationDate))
                    .ToList();
                dbContext.Audits.Add(new Audit(
                    ownerUserId,
                    now,
                    "AssetUpdate",
                    AssetAuditText.Updated(asset.Id, before, DetailsOf(asset), AuditValuations(added), removed)));
                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return asset;
            });

            outcome = "success";
            logger.LogInformation("Asset {AssetId} was saved by edit {EditId}.", assetId, editId);
            return AssetDetailResponse.From(saved);
        }
        catch (ApiProblemException exception)
        {
            logger.LogInformation(
                "Asset {AssetId} save was rejected with status {StatusCode}.",
                assetId,
                exception.StatusCode);
            throw;
        }
        finally
        {
            AssetMetrics.RecordSave("update", outcome, started);
        }
    }

    public async Task DeleteAsync(
        string ownerUserId,
        Guid assetId,
        CancellationToken cancellationToken)
    {
        var started = AssetMetrics.Start();
        var outcome = "failure";
        try
        {
            var strategy = dbContext.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                dbContext.ChangeTracker.Clear();
                await using var transaction = await dbContext.Database.BeginTransactionAsync(
                    IsolationLevel.ReadCommitted,
                    cancellationToken);
                if (!await dbContext.LockAssetAsync(ownerUserId, assetId, cancellationToken))
                {
                    outcome = "not_found";
                    throw AssetProblems.NotFound();
                }

                var now = timeProvider.GetUtcNow();
                // An edit past its expiry no longer blocks, whether or not it is marked yet.
                if (await dbContext.AssetEdits.AnyAsync(
                        edit => edit.AssetId == assetId
                            && edit.State == AssetEditState.Active
                            && edit.ExpiresAtUtc > now,
                        cancellationToken))
                {
                    outcome = "EditActive";
                    throw AssetProblems.DeleteBlocked();
                }

                // Read for the audit text only; one statement then deletes, however long the history.
                var asset = await dbContext.Assets
                    .AsNoTracking()
                    .Include(item => item.Valuations)
                    .SingleAsync(item => item.Id == assetId, cancellationToken);
                dbContext.Audits.Add(new Audit(
                    ownerUserId,
                    now,
                    "AssetDelete",
                    AssetAuditText.Deleted(asset.Id, DetailsOf(asset), AuditValuations(asset.Valuations))));
                // Valuations and edits go with the asset through the database cascade.
                await dbContext.Assets
                    .Where(item => item.Id == assetId)
                    .ExecuteDeleteAsync(cancellationToken);
                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            });

            outcome = "success";
            logger.LogInformation("Asset {AssetId} was deleted.", assetId);
        }
        catch (ApiProblemException exception)
        {
            logger.LogInformation(
                "Asset {AssetId} delete was rejected with status {StatusCode}.",
                assetId,
                exception.StatusCode);
            throw;
        }
        finally
        {
            AssetMetrics.RecordDelete(outcome, started);
        }
    }

    // Active -> Saved, releasing the lease. Writes nothing unless it returns "success".
    private async Task<string> ClaimEditAsync(
        Guid assetId,
        Guid editId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var edit = await dbContext.AssetEdits
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == editId && item.AssetId == assetId, cancellationToken);
        if (edit is null)
        {
            return "changed";
        }

        if (edit.State == AssetEditState.Ended)
        {
            return "ended";
        }

        if (edit.IsExpiredAt(now))
        {
            return "expired";
        }

        return edit.TrySave(now)
            && await dbContext.TryMovePointerAsync(assetId, editId, null, cancellationToken)
            && await dbContext.TryPersistTransitionAsync(edit, cancellationToken)
                ? "success"
                : "changed";
    }

    private static AssetAuditDetails DetailsOf(Asset asset) =>
        new(asset.Name, asset.Description, asset.CurrencyCode);

    private static List<AssetAuditValuation> AuditValuations(IEnumerable<AssetValuation> valuations) =>
        valuations
            .OrderByDescending(valuation => valuation.ValuationDate)
            .Select(valuation => new AssetAuditValuation(valuation.Value, valuation.ValuationDate))
            .ToList();

    private static string FormatTotal(decimal total, string currencyCode)
    {
        // The check constraint keeps every stored code supported.
        var minorUnits = Currency.TryGet(currencyCode, out var currency) ? currency!.MinorUnits : 2;
        return total.ToString($"F{minorUnits}", CultureInfo.InvariantCulture);
    }
}
